"""PDF receipt generation for paid CampusGadgets orders."""

from __future__ import annotations

from io import BytesIO
from decimal import Decimal
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app import models


def build_receipt_pdf(order: models.Order) -> bytes:
    """Render a paid order as a downloadable PDF receipt."""
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"CampusGadgets Receipt - {order.id}",
        author="CampusGadgets",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReceiptTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=22,
        leading=27,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4 * mm,
    ))
    styles.add(ParagraphStyle(
        name="Muted",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
    ))
    styles.add(ParagraphStyle(
        name="RightValue",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
    ))
    styles.add(ParagraphStyle(
        name="Total",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#2563eb"),
    ))

    def money(value: Decimal | float | int | None) -> str:
        return f"₹{Decimal(str(value or 0)):,.2f}"

    story = [
        Paragraph("CampusGadgets", styles["ReceiptTitle"]),
        Paragraph("Payment Receipt", styles["Heading2"]),
        Spacer(1, 6 * mm),
    ]

    order_date = order.created_at.strftime("%d %b %Y, %I:%M %p") if order.created_at else "—"
    details = [
        [Paragraph("Order ID", styles["Muted"]), Paragraph(str(order.id), styles["RightValue"])],
        [Paragraph("Order Date", styles["Muted"]), Paragraph(order_date, styles["RightValue"])],
        [Paragraph("Payment Method", styles["Muted"]), Paragraph("Razorpay", styles["RightValue"])],
        [Paragraph("Payment Status", styles["Muted"]), Paragraph("Paid", styles["RightValue"])],
        [Paragraph("Razorpay Order ID", styles["Muted"]), Paragraph(order.razorpay_order_id or "—", styles["RightValue"])],
        [Paragraph("Razorpay Payment ID", styles["Muted"]), Paragraph(order.razorpay_payment_id or "—", styles["RightValue"])],
    ]
    details_table = Table(details, colWidths=[48 * mm, 112 * mm])
    details_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([details_table, Spacer(1, 10 * mm), Paragraph("Items", styles["Heading2"]), Spacer(1, 3 * mm)])

    item_rows = [[
        Paragraph("Item", styles["Muted"]),
        Paragraph("Qty", styles["Muted"]),
        Paragraph("Unit Price", styles["Muted"]),
        Paragraph("Line Total", styles["Muted"]),
    ]]
    for item in order.items:
        product_name = item.product.name if item.product else f"Product #{item.product_id}"
        unit_price = Decimal(str(item.price_at_purchase or 0))
        line_total = unit_price * item.quantity
        item_rows.append([
            Paragraph(escape(str(product_name)), styles["Normal"]),
            Paragraph(str(item.quantity), styles["Normal"]),
            Paragraph(money(unit_price), styles["RightValue"]),
            Paragraph(money(line_total), styles["RightValue"]),
        ])

    items_table = Table(item_rows, colWidths=[78 * mm, 18 * mm, 35 * mm, 35 * mm], repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([
        items_table,
        Spacer(1, 7 * mm),
        Table(
            [[Paragraph("Grand Total", styles["Heading2"]), Paragraph(money(order.total_amount), styles["Total"])]],
            colWidths=[96 * mm, 70 * mm],
            style=TableStyle([
                ("LINEABOVE", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
            ]),
        ),
        Spacer(1, 22 * mm),
    ])

    def draw_footer(canvas, _document) -> None:
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
        canvas.line(20 * mm, 14 * mm, A4[0] - 20 * mm, 14 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.drawCentredString(A4[0] / 2, 9 * mm, "This is a computer generated receipt")
        canvas.restoreState()

    document.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return output.getvalue()
