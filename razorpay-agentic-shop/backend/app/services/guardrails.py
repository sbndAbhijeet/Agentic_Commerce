"""
Server-side guardrails for money-related actions.

Centralises all validation constants and checks so both the agent tools
and REST routers enforce identical rules.  Every blocked action is
logged to the ``AuditLog`` table with a clear reason.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────
MAX_ITEM_QUANTITY: int = 5
MAX_CART_VALUE: Decimal = Decimal("1000000.00")  # ₹10,00,000
MAX_ORDER_VALUE: Decimal = Decimal("1000000.00")  # ₹10,00,000
ORDER_RATE_WINDOW_SECONDS: int = 60
MAX_ORDERS_PER_RATE_WINDOW: int = 3


# ── Validation helpers ───────────────────────────────────────────────

def validate_item_quantity(quantity: int) -> tuple[bool, str | None]:
    """Reject quantities exceeding the per-item cap.

    Returns:
        ``(True, None)`` when valid, ``(False, error_message)`` otherwise.
    """
    if quantity > MAX_ITEM_QUANTITY:
        return False, (
            f"Maximum quantity per item is {MAX_ITEM_QUANTITY}. "
            f"Requested: {quantity}."
        )
    return True, None


def validate_quantity_against_stock(
    quantity: int,
    stock: int,
) -> tuple[bool, str | None]:
    """Ensure the requested cart quantity fits stock and the safety cap."""
    if stock <= 0:
        return False, "This product is out of stock."
    if quantity > stock:
        return False, (
            f"Only {stock} unit{' is' if stock == 1 else 's are'} available. "
            f"Requested: {quantity}."
        )
    return validate_item_quantity(quantity)


def validate_cart_value(
    current_total: Decimal,
    added_value: Decimal,
) -> tuple[bool, str | None]:
    """Reject if the projected cart total would exceed the cap.

    Args:
        current_total: Sum of *existing* cart items (excluding the item
            being added / updated).
        added_value: Price × quantity for the item being added or updated.

    Returns:
        ``(True, None)`` when valid, ``(False, error_message)`` otherwise.
    """
    projected = current_total + added_value
    if projected > MAX_CART_VALUE:
        return False, (
            f"Cart total exceeds the maximum allowed limit of {format_inr(MAX_CART_VALUE)}. "
            f"Projected total: {format_inr(projected)}."
        )
    return True, None


def format_inr(amount: Decimal) -> str:
    """Format a Decimal as a readable Indian-rupee amount."""
    whole, fraction = f"{amount:.2f}".split(".")
    sign = "-" if whole.startswith("-") else ""
    digits = whole.lstrip("-")
    if len(digits) <= 3:
        indian_whole = digits
    else:
        prefix, last_three = digits[:-3], digits[-3:]
        groups = []
        while prefix:
            groups.insert(0, prefix[-2:])
            prefix = prefix[:-2]
        indian_whole = ",".join(groups + [last_three])
    return f"₹{sign}{indian_whole}.{fraction}"


def verify_prices_against_catalog(
    db: Session,
    cart_items: list[models.CartItem],
) -> tuple[bool, str | None, list[dict[str, Any]]]:
    """Re-read each product's live price and compare to the cart snapshot.

    Returns:
        ``(True, None, [])`` when all prices match.
        ``(False, error_message, mismatches)`` when at least one price has
        changed since the item was added.
    """
    mismatches: list[dict[str, Any]] = []
    for ci in cart_items:
        live_product = (
            db.query(models.Product)
            .filter(models.Product.id == ci.product_id)
            .first()
        )
        if live_product is None:
            mismatches.append({
                "product_id": ci.product_id,
                "reason": "Product no longer exists in the catalog.",
            })
            continue

        live_price = Decimal(str(live_product.price))
        cart_price = Decimal(str(ci.product.price)) if ci.product else None
        if cart_price is None or live_price != cart_price:
            mismatches.append({
                "product_id": ci.product_id,
                "product_name": live_product.name,
                "cart_price": float(cart_price) if cart_price is not None else None,
                "catalog_price": float(live_price),
            })

    if mismatches:
        names = ", ".join(
            m.get("product_name", f"ID {m['product_id']}") for m in mismatches
        )
        return False, (
            f"Price mismatch detected for: {names}. "
            "Please refresh your cart — product prices have changed."
        ), mismatches

    return True, None, []


def validate_order_preconditions(
    db: Session,
    cart: models.Cart,
) -> tuple[bool, str | None]:
    """Run all guardrail checks required before creating an order.

    Checks (in order):
    1. Cart must not be empty.
    2. Every item quantity must be ≤ MAX_ITEM_QUANTITY.
    3. Prices must match the current catalog.
    4. Total must be > 0 and ≤ MAX_CART_VALUE.

    Returns:
        ``(True, None)`` when all checks pass.
        ``(False, error_message)`` on the first violation.
    """
    if not cart.items:
        return False, "Cannot create an order from an empty cart."

    total = Decimal("0.00")
    for ci in cart.items:
        # Quantity cap
        ok, msg = validate_item_quantity(ci.quantity)
        if not ok:
            return False, f"Item '{ci.product.name if ci.product else ci.product_id}': {msg}"

        if ci.product is None or ci.product.price is None:
            return False, f"Product {ci.product_id} is unavailable."
        if not ci.product.is_active:
            return False, f"Product '{ci.product.name}' is inactive."
        if ci.quantity < 1 or ci.quantity > ci.product.stock:
            return False, f"Cart quantity for '{ci.product.name}' is unavailable."

        total += Decimal(str(ci.product.price)) * ci.quantity

    # Total must be positive
    if total <= 0:
        return False, "Order total must be greater than zero."

    # Cart value cap
    if total > MAX_ORDER_VALUE:
        return False, (
            f"Order total exceeds the maximum allowed limit of {format_inr(MAX_ORDER_VALUE)}. "
            f"Current total: {format_inr(total)}."
        )

    # Price re-verification against live catalog
    ok, msg, _ = verify_prices_against_catalog(db, cart.items)
    if not ok:
        return False, msg

    return True, None


def check_order_rate(
    db: Session,
    user_id: str,
) -> tuple[bool, str | None]:
    """Apply a small cooldown after several orders in a short time window."""
    cutoff = datetime.utcnow() - timedelta(seconds=ORDER_RATE_WINDOW_SECONDS)
    recent_order_count = (
        db.query(models.Order)
        .filter(
            models.Order.user_id == user_id,
            models.Order.created_at >= cutoff,
        )
        .count()
    )
    if recent_order_count >= MAX_ORDERS_PER_RATE_WINDOW:
        return False, (
            "You have created several orders recently. Please wait a minute "
            "before trying again. Your existing orders are still safe."
        )
    return True, None


# ── Audit logging ────────────────────────────────────────────────────

def log_blocked_action(
    db: Session,
    *,
    action: str,
    reason: str,
    user_id: str | None = None,
    session_id: str | None = None,
    cart_id: str | None = None,
) -> str | None:
    """Write an AuditLog entry for a blocked money-related action.

    Returns:
        The audit log ID on success, ``None`` if persisting fails.
    """
    try:
        audit = models.AuditLog(
            session_id=session_id or "system",
            user_id=user_id,
            user_message=f"[BLOCKED] {action}",
            agent_response=reason,
            reasoning=f"Guardrail blocked: {reason}",
            cart_id=cart_id,
        )
        db.add(audit)
        db.commit()
        logger.info("Blocked action logged: %s — %s", action, reason)
        return str(audit.id)
    except Exception:
        db.rollback()
        logger.exception("Failed to log blocked action")
        return None
