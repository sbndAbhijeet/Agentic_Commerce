import random
from app.database import SessionLocal
from app.models import Product, User, Cart, CartItem, Order, OrderItem
import app.models as models

def seed_data():
    db = SessionLocal()
    
    # Check if we already have data
    if db.query(Product).first():
        print("Database already seeded! Dropping existing products for a fresh seed...")
        db.query(Product).delete()
        db.commit()

    products_data = [
        # Laptops
        ("CampusBook Pro 14", "Lightweight laptop for daily coding and notes.", 45000, "Laptops"),
        ("GamerTech Alpha 15", "Entry-level gaming laptop with dedicated GPU.", 58000, "Laptops"),
        ("StudentMate Air", "Ultra-thin laptop with 12-hour battery life.", 35000, "Laptops"),
        ("CodeNinja 15.6", "Reliable performance for programming and multitasking.", 41000, "Laptops"),
        ("Visionary Flip 360", "2-in-1 convertible laptop perfect for reading and drawing.", 52000, "Laptops"),
        ("EcoTech Basic 14", "Budget-friendly laptop for document editing and web browsing.", 25000, "Laptops"),
        ("PowerStation Pro", "High-performance workstation for video editing and 3D modeling.", 59999, "Laptops"),
        ("CampusBook Lite", "Chrome-based OS laptop for cloud-focused studying.", 18000, "Laptops"),
        
        # Headphones
        ("BassBoom Wireless Over-Ear", "Immersive bass and 30-hour battery for long study sessions.", 2500, "Headphones"),
        ("Aura ANC Pods", "Active noise cancellation earbuds to block out dorm noise.", 3499, "Headphones"),
        ("StudentBeat Wired", "Durable, high-quality wired earphones with built-in mic.", 599, "Headphones"),
        ("FocusTech Neckband", "Comfortable wireless neckband for workouts and lectures.", 1299, "Headphones"),
        ("ProStudio Monitors", "Studio-quality over-ear headphones for audio enthusiasts.", 4500, "Headphones"),
        ("GamerSound Headset", "Surround sound gaming headset with clear microphone.", 2199, "Headphones"),
        ("EcoBuds True Wireless", "Affordable and compact TWS earbuds.", 999, "Headphones"),
        ("Aura Max ANC", "Premium noise-cancelling over-ear headphones.", 5999, "Headphones"),

        # Accessories
        ("PowerBoost 10000mAh Power Bank", "Compact fast-charging power bank.", 999, "Accessories"),
        ("FlexiStand Laptop Riser", "Ergonomic adjustable laptop stand for desk setup.", 899, "Accessories"),
        ("TypeFast Wireless Keyboard", "Multi-device Bluetooth keyboard.", 1499, "Accessories"),
        ("Precision Wireless Mouse", "Ergonomic mouse with adjustable DPI.", 799, "Accessories"),
        ("DeskPad Pro Extended", "Large smooth desk mat for keyboard and mouse.", 599, "Accessories"),
        ("SpeedCharge 65W GaN Adapter", "Universal fast charger for laptops and phones.", 1899, "Accessories"),
        ("ToughBraid USB-C Cable (2m)", "Durable nylon-braided charging cable.", 399, "Accessories"),
        ("CampusPack Tech Organizer", "Travel pouch for cables, chargers, and drives.", 499, "Accessories"),

        # Study Essentials
        ("SmartPen Sync", "Digital smart pen that syncs handwritten notes to your phone.", 4500, "Study Essentials"),
        ("FocusLight LED Desk Lamp", "Eye-care reading lamp with adjustable brightness.", 1199, "Study Essentials"),
        ("EverLast Smart Notebook", "Reusable digital notebook with cloud sync.", 1899, "Study Essentials"),
        ("NoiseBlock Earplugs", "High-fidelity earplugs for studying in noisy environments.", 599, "Study Essentials"),
        ("ErgoCushion Seat Pad", "Memory foam cushion for long hours of desk sitting.", 899, "Study Essentials"),
        ("Whiteboard Sticker Roll", "Turn any wall into a whiteboard for brainstorming.", 499, "Study Essentials"),
        ("Kindle Paperwhite (Student Edition)", "E-reader for textbooks and novels without eye strain.", 13999, "Study Essentials"),
        ("Posture Corrector Brace", "Comfortable brace to maintain good posture while studying.", 699, "Study Essentials"),

        # Smartwatches
        ("ActiveFit Band", "Basic fitness tracker for steps, sleep, and heart rate.", 1499, "Smartwatches"),
        ("CampusWatch Pro", "Smartwatch with Bluetooth calling and fitness tracking.", 2999, "Smartwatches"),
        ("StyleSync Dial", "Elegant smartwatch with customizable digital faces.", 3499, "Smartwatches"),
        ("Endurance Sport Watch", "Rugged smartwatch with built-in GPS and long battery.", 4999, "Smartwatches"),
        ("Minimalist Tech Watch", "Sleek smartwatch focused on notifications and health.", 2499, "Smartwatches"),
        ("Aura Health Band", "Advanced health tracker with SpO2 and stress monitoring.", 2199, "Smartwatches"),
        ("GamerTime Smart Edition", "Gaming-themed smartwatch with unique UI.", 1999, "Smartwatches"),
        ("CampusWatch Lite", "Entry-level smartwatch with essential tracking features.", 1199, "Smartwatches"),
    ]

    products = []
    for name, desc, price, cat in products_data:
        # Generate some realistic stock values
        stock = random.randint(10, 150)
        
        products.append(
            Product(
                name=name,
                description=desc,
                price=price,
                category=cat,
                stock=stock,
                is_active=True
            )
        )

    db.add_all(products)
    db.commit()
    print(f"Successfully seeded database with {len(products)} CampusGadgets products.")
    # Create sample users
    user1 = User(email="alice@example.com", full_name="Alice", is_active=True)
    user2 = User(email="bob@example.com", full_name="Bob", is_active=True)
    db.add_all([user1, user2])
    db.commit()
    db.refresh(user1)
    db.refresh(user2)

    # Create a sample cart for user1
    cart = Cart(user_id=user1.id)
    db.add(cart)
    db.commit()
    db.refresh(cart)

    # Add 2-3 items to cart (use first three products)
    sample_products = db.query(Product).limit(3).all()
    for prod in sample_products:
        cart_item = CartItem(cart_id=cart.id, product_id=prod.id, quantity=1)
        db.add(cart_item)
    db.commit()

    # Create a sample order in pending status from this cart
    total_amount = sum(item.quantity * item.product.price for item in db.query(CartItem).filter(CartItem.cart_id == cart.id).all())
    order = Order(user_id=user1.id, status="pending", total_amount=total_amount)
    db.add(order)
    db.commit()
    db.refresh(order)
    # Copy cart items to order items
    for ci in db.query(CartItem).filter(CartItem.cart_id == cart.id).all():
        order_item = OrderItem(
            order_id=order.id,
            product_id=ci.product_id,
            quantity=ci.quantity,
            price_at_purchase=ci.product.price,
        )
        db.add(order_item)
    db.commit()

    print("Sample users, cart, and order created.")
    db.close()

if __name__ == "__main__":
    seed_data()
