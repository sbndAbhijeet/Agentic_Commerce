"""Small Razorpay Test Mode integration for order creation and verification."""

from __future__ import annotations

from typing import Any

import razorpay
from razorpay.errors import SignatureVerificationError

from app.core.config import settings


def create_razorpay_order(
    amount_in_paise: int,
    receipt: str,
    notes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a Razorpay order using an amount expressed in paise.

    Args:
        amount_in_paise: Positive integer amount in paise. ₹1 equals 100 paise.
        receipt: Merchant-generated receipt identifier for the order.
        notes: Optional key/value metadata attached to the Razorpay order.

    Returns:
        The order dictionary returned by Razorpay.

    Raises:
        ValueError: If amount, receipt, or notes are invalid.
        RuntimeError: If Razorpay credentials are not configured.
        razorpay.errors.BadRequestError: If Razorpay rejects the request.
    """
    if (
        not isinstance(amount_in_paise, int)
        or isinstance(amount_in_paise, bool)
        or amount_in_paise <= 0
    ):
        raise ValueError("amount_in_paise must be a positive integer in paise.")
    if not isinstance(receipt, str) or not receipt.strip():
        raise ValueError("receipt must be a non-empty string.")
    if notes is not None and not isinstance(notes, dict):
        raise ValueError("notes must be a dictionary when provided.")

    client = _get_client()
    order_data: dict[str, Any] = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": receipt,
    }
    if notes:
        order_data["notes"] = notes
    return client.order.create(data=order_data)


def verify_payment_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    """Verify a Razorpay payment signature using the configured secret.

    Returns ``False`` for malformed values or an invalid signature. Credential
    configuration errors are raised because verification cannot be performed
    safely without the secret.
    """
    if not all(
        isinstance(value, str) and value.strip()
        for value in (razorpay_order_id, razorpay_payment_id, razorpay_signature)
    ):
        return False

    try:
        _get_client().utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
        return True
    except SignatureVerificationError:
        return False


def fetch_razorpay_payment(payment_id: str) -> dict[str, Any]:
    """Fetch a payment from Razorpay for server-side amount verification."""
    if not isinstance(payment_id, str) or not payment_id.strip():
        raise ValueError("payment_id must be a non-empty string.")
    return _get_client().payment.fetch(payment_id)


def _get_client() -> razorpay.Client:
    """Create a configured SDK client lazily for each operation."""
    key_id = settings.RAZORPAY_KEY_ID.strip()
    key_secret = settings.RAZORPAY_KEY_SECRET.strip()
    if not key_id or not key_secret:
        raise RuntimeError(
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured."
        )
    if not key_id.startswith("rzp_test_"):
        raise RuntimeError("Only Razorpay Test Mode keys (rzp_test_*) are supported.")
    return razorpay.Client(auth=(key_id, key_secret))
