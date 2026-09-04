"""
Agent Tools — callable functions the AI agent uses to interact with
the Agentic Commerce backend (products, carts, orders).

Each function:
  • Accepts a SQLAlchemy Session (db) as its first argument.
  • Returns a plain dict so results can be serialised to JSON for the LLM.
  • Never raises — errors are returned as {"error": "..."} dicts.

The TOOLS_SCHEMA list at the bottom is the OpenAI-compatible function-calling
schema that should be sent alongside the system prompt.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.services.guardrails import (
    MAX_ITEM_QUANTITY,
    MAX_CART_VALUE,
    check_order_rate,
    log_blocked_action,
    validate_cart_value,
    validate_quantity_against_stock,
    validate_item_quantity,
    validate_order_preconditions,
)
from app.services.razorpay_service import create_razorpay_order



def search_products(db: Session, query: str, limit: int = 5) -> dict[str, Any]:
    """Search the product catalog by name or description.

    Args:
        db: Active database session.
        query: Free-text search term (matched against product name and description).
        limit: Maximum number of results to return (default 5).

    Returns:
        A dict with a "products" key containing a list of matching product dicts,
        or an "error" key if something went wrong.
    """
    try:
        if not isinstance(query, str) or not query.strip():
            return {"error": "Search query must not be empty."}
        if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
            return {"error": "Limit must be a positive integer."}

        search_term = f"%{query}%"
        products = (
            db.query(models.Product)
            .filter(
                models.Product.is_active == True,
                or_(
                    models.Product.name.ilike(search_term),
                    models.Product.description.ilike(search_term),
                ),
            )
            .limit(limit)
            .all()
        )

        return {
            "products": [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "price": float(p.price),
                    "category": p.category,
                    "stock": p.stock,
                    "image_url": p.image_url,
                }
                for p in products
            ],
            "count": len(products),
        }
    except Exception as e:
        return {"error": f"Failed to search products: {str(e)}"}


def get_product(db: Session, product_id: str) -> dict[str, Any]:
    """Get full details of a single product by its ID.

    Args:
        db: Active database session.
        product_id: The product ID supplied by the agent.

    Returns:
        A dict with the product details, or an "error" key if not found.
    """
    try:
        product_id_int = _parse_product_id(product_id)
        if product_id_int is None:
            return {"error": f"Invalid product id: {product_id}."}

        product = (
            db.query(models.Product)
            .filter(models.Product.id == product_id_int)
            .first()
        )
        if not product:
            return {"error": f"Product with id {product_id} not found."}

        return {
            "product": {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": float(product.price),
                "category": product.category,
                "stock": product.stock,
                "image_url": product.image_url,
                "is_active": product.is_active,
            }
        }
    except Exception as e:
        return {"error": f"Failed to get product: {str(e)}"}



def add_to_cart(
    db: Session,
    cart_id: str,
    product_id: str,
    quantity: int = 1,
    user_id: str | None = None,
    user_confirmed: bool = False,
) -> dict[str, Any]:
    """Add a product to the cart, or update its quantity if already present.

    If the product is already in the cart the quantity is *replaced*
    (not incremented) with the supplied value — the caller (agent) is
    responsible for computing the desired quantity.

    Args:
        db: Active database session.
        cart_id: UUID string of the cart.
        product_id: Product ID supplied by the agent.
        quantity: Desired quantity (default 1).

    Returns:
        The updated cart summary dict, or an "error" key.
    """
    try:
        # The OpenAI schema intentionally remains unchanged; the execution
        # layer injects this internal flag only after a current-turn
        # confirmation has been detected.
        if not user_confirmed:
            reason = (
                "Adding items requires explicit user confirmation. "
                "Show the item and exact cart total, then ask the user to confirm."
            )
            log_blocked_action(
                db, action="add_to_cart", reason=reason,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": reason}

        product_id_int = _parse_product_id(product_id)
        if product_id_int is None:
            return {"error": f"Invalid product id: {product_id}."}
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
            return {"error": "Quantity must be a positive integer."}

        # ── Guardrail: quantity cap ──────────────────────────────
        ok, msg = validate_item_quantity(quantity)
        if not ok:
            log_blocked_action(
                db, action="add_to_cart", reason=msg,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": msg}

        cart = db.query(models.Cart).filter(models.Cart.id == cart_id, models.Cart.user_id == user_id).first()
        if not cart:
            return {"error": f"Cart {cart_id} not found."}

        product = (
            db.query(models.Product)
            .filter(models.Product.id == product_id_int)
            .first()
        )
        if not product:
            return {"error": f"Product {product_id} not found."}

        if not product.is_active:
            return {"error": f"Product '{product.name}' is inactive."}
        stock_ok, stock_message = validate_quantity_against_stock(quantity, product.stock)
        if not stock_ok:
            reason = stock_message or "Requested quantity exceeds available stock"
            log_blocked_action(
                db, action="add_to_cart", reason=reason,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": f"{reason} Product: '{product.name}'."}

        # ── Guardrail: cart value cap ────────────────────────────
        # Calculate existing total *excluding* this product (in case of update)
        existing_total = Decimal("0.00")
        for ci in cart.items:
            if ci.product and ci.product_id != product_id_int:
                existing_total += Decimal(str(ci.product.price)) * ci.quantity
        added_value = Decimal(str(product.price)) * quantity
        ok, msg = validate_cart_value(existing_total, added_value)
        if not ok:
            log_blocked_action(
                db, action="add_to_cart", reason=msg,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": msg}

        # Upsert cart item
        cart_item = (
            db.query(models.CartItem)
            .filter(
                models.CartItem.cart_id == cart_id,
                models.CartItem.product_id == product_id_int,
            )
            .first()
        )
        if cart_item:
            cart_item.quantity = quantity
        else:
            cart_item = models.CartItem(
                cart_id=cart_id,
                product_id=product_id_int,
                quantity=quantity,
            )
            db.add(cart_item)

        db.commit()
        db.refresh(cart)

        return _build_cart_dict(cart)
    except Exception as e:
        db.rollback()
        return {"error": f"Failed to add to cart: {str(e)}"}



def view_cart(db: Session, cart_id: str, user_id: str | None = None) -> dict[str, Any]:
    """Return the current state of a cart including all items and the total.

    Args:
        db: Active database session.
        cart_id: UUID string of the cart.

    Returns:
        A dict with "cart" containing id, items list, and total —
        or an "error" key.
    """
    try:
        cart = db.query(models.Cart).filter(models.Cart.id == cart_id, models.Cart.user_id == user_id).first()
        if not cart:
            return {"error": f"Cart {cart_id} not found."}

        return _build_cart_dict(cart)
    except Exception as e:
        return {"error": f"Failed to view cart: {str(e)}"}



def create_order(
    db: Session,
    cart_id: str,
    user_id: str,
    user_confirmed: bool = False,
) -> dict[str, Any]:
    """Create a new pending order from an existing cart.

    Copies every cart item into order items, calculates the total, and
    returns the new order summary.  The cart is **not** cleared so the
    frontend can still display it.

    Requires ``user_confirmed=True`` — the server rejects order creation
    unless explicit user confirmation has been obtained.

    Args:
        db: Active database session.
        cart_id: UUID string of the source cart.
        user_id: UUID string of the user placing the order.
        user_confirmed: Must be True to proceed; enforced server-side.

    Returns:
        A dict with "order" containing id, status, items, and total —
        or an "error" key.
    """
    try:
        # ── Guardrail: explicit user confirmation ────────────────
        if not user_confirmed:
            reason = (
                "Order creation requires explicit user confirmation. "
                "Please confirm with the user before placing the order."
            )
            log_blocked_action(
                db, action="create_order", reason=reason,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": reason}

        cart = db.query(models.Cart).filter(models.Cart.id == cart_id, models.Cart.user_id == user_id).first()
        if not cart:
            return {"error": f"Cart {cart_id} not found."}

        rate_ok, rate_message = check_order_rate(db, user_id)
        if not rate_ok:
            log_blocked_action(
                db, action="create_order", reason=rate_message,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": rate_message}

        # ── Guardrails: full pre-order validation ────────────────
        ok, msg = validate_order_preconditions(db, cart)
        if not ok:
            log_blocked_action(
                db, action="create_order", reason=msg,
                user_id=user_id, cart_id=cart_id,
            )
            return {"error": msg}

        # Calculate total (already validated above)
        total = Decimal("0.00")
        for ci in cart.items:
            total += Decimal(str(ci.product.price)) * ci.quantity

        # Create the order and its items in one transaction so a failure does
        # not leave an order row without its copied items.
        order = models.Order(
            user_id=user_id,
            status="pending",
            total_amount=total,
        )
        db.add(order)
        db.flush()

        # Copy cart items → order items
        for ci in cart.items:
            if ci.product is None or ci.product.price is None:
                raise ValueError(f"Product {ci.product_id} is unavailable.")
            order_item = models.OrderItem(
                order_id=order.id,
                product_id=ci.product_id,
                quantity=ci.quantity,
                price_at_purchase=ci.product.price,
            )
            db.add(order_item)
        db.commit()
        db.refresh(order)

        amount_in_paise = int((total * 100).quantize(Decimal("1")))
        razorpay_order = create_razorpay_order(
            amount_in_paise=amount_in_paise,
            receipt=order.id,
            notes={"local_order_id": order.id, "cart_id": cart_id},
        )
        razorpay_order_id = razorpay_order.get("id")
        if not razorpay_order_id:
            raise ValueError("Razorpay returned an invalid order response.")
        order.razorpay_order_id = razorpay_order_id
        db.commit()
        db.refresh(order)

        return {
            "order": {
                "id": order.id,
                "status": order.status,
                "total_amount": float(order.total_amount),
                "user_id": order.user_id,
                "razorpay_order_id": order.razorpay_order_id,
                "items": [
                    {
                        "product_id": oi.product_id,
                        "product_name": oi.product.name if oi.product else None,
                        "quantity": oi.quantity,
                        "price_at_purchase": float(oi.price_at_purchase),
                    }
                    for oi in order.items
                ],
                "created_at": order.created_at.isoformat(),
            },
            "razorpay_order": {
                "id": razorpay_order_id,
                "amount": int(razorpay_order.get("amount", amount_in_paise)),
                "currency": razorpay_order.get("currency", "INR"),
                "key_id": settings.RAZORPAY_KEY_ID,
            },
        }
    except Exception as e:
        db.rollback()
        return {"error": f"Failed to create order: {str(e)}"}


def _build_cart_dict(cart: models.Cart) -> dict[str, Any]:
    """Serialise a Cart ORM object into a clean dict for the agent."""
    total = Decimal("0.00")
    items = []
    for item in cart.items:
        item_price = float(item.product.price) if item.product else 0.0
        item_total = item_price * item.quantity
        total += Decimal(str(item_price)) * item.quantity
        items.append(
            {
                "cart_item_id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "Unknown",
                "quantity": item.quantity,
                "unit_price": item_price,
                "item_total": round(item_total, 2),
            }
        )

    return {
        "cart": {
            "id": cart.id,
            "user_id": cart.user_id,
            "items": items,
            "item_count": len(items),
            "total": float(total),
        }
    }


def _parse_product_id(product_id: str) -> int | None:
    """Convert an agent-supplied product ID to the database's integer ID."""
    try:
        value = int(product_id)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None



TOOL_FUNCTIONS: dict[str, Any] = {
    "search_products": search_products,
    "get_product": get_product,
    "add_to_cart": add_to_cart,
    "view_cart": view_cart,
    "create_order": create_order,
}


# OpenAI-compatible tools schema
TOOLS_SCHEMA: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Search the product catalog by name or description. "
                "Returns a list of matching products with id, name, price, "
                "stock, and category."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Free-text search term to match against product name or description.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default 5).",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product",
            "description": (
                "Get full details (name, description, price, stock, category, "
                "image) of a single product by its numeric ID."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "string",
                        "description": "The product ID.",
                    },
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_cart",
            "description": (
                "Add a product to the user's cart or update its quantity. "
                "The quantity value replaces the current quantity (it is not "
                "additive). Returns the updated cart with all items and total."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "cart_id": {
                        "type": "string",
                        "description": "UUID of the shopping cart.",
                    },
                    "product_id": {
                        "type": "string",
                        "description": "The product ID to add.",
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "Desired quantity (default 1).",
                        "default": 1,
                    },
                },
                "required": ["cart_id", "product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_cart",
            "description": (
                "View the current contents of a shopping cart. Returns "
                "item list with product names, quantities, unit prices, "
                "and the cart total."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "cart_id": {
                        "type": "string",
                        "description": "UUID of the shopping cart.",
                    },
                },
                "required": ["cart_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": (
                "Create a new pending order from the items currently in the "
                "cart. IMPORTANT: You MUST obtain explicit user confirmation "
                "before calling this tool and set user_confirmed=true. "
                "The server will reject the call otherwise. "
                "Maximum 5 units per item, maximum cart and single order value ₹10,00,000. "
                "Returns the order summary with order ID, status, "
                "total amount, and item breakdown."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "cart_id": {
                        "type": "string",
                        "description": "UUID of the cart to convert into an order.",
                    },
                    "user_id": {
                        "type": "string",
                        "description": "UUID of the authenticated user placing the order.",
                    },
                    "user_confirmed": {
                        "type": "boolean",
                        "description": (
                            "Must be true. Set this only after the user has "
                            "explicitly confirmed they want to place the order."
                        ),
                        "default": False,
                    },
                },
                "required": ["cart_id", "user_id", "user_confirmed"],
            },
        },
    },
]
