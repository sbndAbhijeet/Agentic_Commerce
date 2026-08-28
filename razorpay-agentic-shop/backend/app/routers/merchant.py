import json
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.config import settings
from app.core.security import get_current_merchant_user
from app.database import get_db

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PAID_STATUSES = ("paid", "completed")

router = APIRouter(prefix="/api/v1/merchant", tags=["merchant"])


def _api_key_configured() -> bool:
    key = settings.OPENROUTER_API_KEY.strip()
    return bool(key) and key.lower() not in {
        "your-openrouter-api-key",
        "replace-with-your-openrouter-api-key",
    }


def _build_dashboard(db: Session, merchant_id: str) -> schemas.MerchantDashboardResponse:
    total_products = (
        db.query(func.count(models.Product.id))
        .filter(models.Product.merchant_id == merchant_id)
        .scalar()
        or 0
    )
    low_stock_count = (
        db.query(func.count(models.Product.id))
        .filter(models.Product.merchant_id == merchant_id, models.Product.stock < 5)
        .scalar()
        or 0
    )
    total_orders = (
        db.query(func.count(func.distinct(models.Order.id)))
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .join(models.Product, models.Product.id == models.OrderItem.product_id)
        .filter(models.Product.merchant_id == merchant_id)
        .scalar()
        or 0
    )
    total_revenue = (
        db.query(
            func.coalesce(
                func.sum(models.OrderItem.quantity * models.OrderItem.price_at_purchase),
                0,
            )
        )
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .join(models.Product, models.Product.id == models.OrderItem.product_id)
        .filter(
            models.Product.merchant_id == merchant_id,
            models.Order.status.in_(PAID_STATUSES),
        )
        .scalar()
        or Decimal("0")
    )

    recent_order_rows = (
        db.query(
            models.Order.id.label("order_id"),
            models.Order.status.label("status"),
            func.sum(models.OrderItem.quantity).label("item_count"),
            func.sum(
                models.OrderItem.quantity * models.OrderItem.price_at_purchase
            ).label("total_amount"),
            models.Order.created_at.label("created_at"),
        )
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .join(models.Product, models.Product.id == models.OrderItem.product_id)
        .filter(models.Product.merchant_id == merchant_id)
        .group_by(models.Order.id, models.Order.status, models.Order.created_at)
        .order_by(desc(models.Order.created_at))
        .limit(10)
        .all()
    )
    recent_orders = [
        schemas.MerchantRecentOrder(
            order_id=row.order_id,
            status=row.status,
            item_count=int(row.item_count or 0),
            total_amount=row.total_amount or Decimal("0"),
            created_at=row.created_at,
        )
        for row in recent_order_rows
    ]

    top_product_rows = (
        db.query(
            models.Product.id.label("product_id"),
            models.Product.name.label("name"),
            models.Product.stock.label("stock"),
            models.Product.image_url.label("image_url"),
            func.sum(models.OrderItem.quantity).label("units_sold"),
            func.sum(
                models.OrderItem.quantity * models.OrderItem.price_at_purchase
            ).label("revenue"),
        )
        .join(models.OrderItem, models.OrderItem.product_id == models.Product.id)
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .filter(
            models.Product.merchant_id == merchant_id,
            models.Order.status.in_(PAID_STATUSES),
        )
        .group_by(
            models.Product.id,
            models.Product.name,
            models.Product.stock,
            models.Product.image_url,
        )
        .order_by(desc("units_sold"), desc("revenue"))
        .limit(5)
        .all()
    )
    top_selling_products = [
        schemas.MerchantTopProduct(
            product_id=row.product_id,
            name=row.name,
            units_sold=int(row.units_sold or 0),
            revenue=row.revenue or Decimal("0"),
            stock=int(row.stock or 0),
            image_url=row.image_url,
        )
        for row in top_product_rows
    ]

    return schemas.MerchantDashboardResponse(
        total_orders=int(total_orders),
        total_revenue=total_revenue,
        total_products=int(total_products),
        low_stock_count=int(low_stock_count),
        recent_orders=recent_orders,
        top_selling_products=top_selling_products,
    )


def _serialize_dashboard_for_llm(
    dashboard: schemas.MerchantDashboardResponse,
) -> dict[str, Any]:
    return {
        "total_orders": dashboard.total_orders,
        "total_revenue": str(dashboard.total_revenue),
        "total_products": dashboard.total_products,
        "low_stock_count": dashboard.low_stock_count,
        "recent_orders": [
            {
                "status": order.status,
                "item_count": order.item_count,
                "total_amount": str(order.total_amount),
                "created_at": order.created_at.isoformat(),
            }
            for order in dashboard.recent_orders
        ],
        "top_selling_products": [
            {
                "name": product.name,
                "units_sold": product.units_sold,
                "revenue": str(product.revenue),
                "stock": product.stock,
            }
            for product in dashboard.top_selling_products
        ],
    }


def _extract_json_object(content: str) -> dict[str, Any] | None:
    text = (content or "").strip()
    if not text:
        return None

    candidates = [text]
    if "```json" in text:
        start = text.find("```json") + len("```json")
        end = text.find("```", start)
        if end != -1:
            candidates.append(text[start:end].strip())
    if "```" in text:
        first_fence = text.find("```") + 3
        end = text.find("```", first_fence)
        if end != -1:
            candidates.append(text[first_fence:end].strip())

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidates.append(text[first_brace:last_brace + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _fallback_insights(dashboard: schemas.MerchantDashboardResponse) -> dict[str, Any]:
    top_product = dashboard.top_selling_products[0] if dashboard.top_selling_products else None
    summary_parts = [
        f"You have {dashboard.total_orders} orders across {dashboard.total_products} products, generating {dashboard.total_revenue} in paid revenue."
    ]
    if dashboard.low_stock_count:
        summary_parts.append(
            f"{dashboard.low_stock_count} product(s) are running low on stock and may limit future sales."
        )
    if top_product:
        summary_parts.append(
            f"{top_product.name} is currently your strongest seller with {top_product.units_sold} units sold."
        )

    recommendations = [
        "Restock low-inventory products before they go out of stock and interrupt conversions.",
        "Feature your top-selling products more prominently in listings, campaigns, and bundles.",
        "Review recent orders to spot repeat categories and create cross-sell offers around them.",
        "Prioritize paid acquisition or promotions only for products that already show healthy conversion signals.",
    ]
    if top_product and top_product.stock >= 5:
        recommendations.append(
            f"Test a limited-time promotion for {top_product.name} to accelerate revenue from a proven winner."
        )
    else:
        recommendations.append(
            "Improve product detail pages for mid-tier products to raise average order value and diversify revenue."
        )

    return {
        "summary": " ".join(summary_parts),
        "recommendations": recommendations[:5],
    }


def _generate_insights(dashboard: schemas.MerchantDashboardResponse) -> dict[str, Any]:
    if not _api_key_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenRouter is not configured",
        )

    client = OpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        default_headers={
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "CampusGadgets Merchant Dashboard",
        },
    )

    response = client.chat.completions.create(
        model=settings.AGENT_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a practical ecommerce growth advisor. "
                    "Given merchant dashboard data, return JSON only with keys "
                    '"summary" and "recommendations". '
                    '"summary" should be a concise business overview in 2-4 sentences. '
                    '"recommendations" must be an array of 4 or 5 specific, actionable '
                    "revenue-growth ideas. Do not include markdown fences."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(_serialize_dashboard_for_llm(dashboard)),
            },
        ],
    )

    message_content = response.choices[0].message.content
    content = (
        "".join(part.get("text", "") for part in message_content if isinstance(part, dict))
        if isinstance(message_content, list)
        else (message_content or "")
    )
    parsed = _extract_json_object(content)
    if parsed is None:
        return _fallback_insights(dashboard)

    summary = parsed.get("summary")
    recommendations = parsed.get("recommendations")
    if not isinstance(summary, str) or not summary.strip() or not isinstance(recommendations, list):
        return _fallback_insights(dashboard)

    cleaned_recommendations = [
        item.strip() for item in recommendations if isinstance(item, str) and item.strip()
    ]
    if len(cleaned_recommendations) < 4:
        return _fallback_insights(dashboard)

    return {
        "summary": summary.strip(),
        "recommendations": cleaned_recommendations[:5],
    }


@router.get("/dashboard", response_model=schemas.MerchantDashboardResponse)
def get_merchant_dashboard(
    current_user: models.User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db),
):
    return _build_dashboard(db, current_user.id)


@router.post("/insights", response_model=schemas.MerchantInsightsResponse)
def get_merchant_insights(
    current_user: models.User = Depends(get_current_merchant_user),
    db: Session = Depends(get_db),
):
    dashboard = _build_dashboard(db, current_user.id)
    insights = _generate_insights(dashboard)
    return schemas.MerchantInsightsResponse(
        summary=insights["summary"],
        recommendations=insights["recommendations"],
        dashboard=dashboard,
    )
