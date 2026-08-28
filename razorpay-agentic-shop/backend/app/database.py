from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_auth_columns():
    """Add authentication columns to databases created before auth was added.

    ``create_all`` does not modify existing tables, so older local databases
    need these columns added before the auth router can query the User model.
    """
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("users")
    }
    statements = []
    if "hashed_password" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN hashed_password VARCHAR"
        )
    if "role" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'customer'"
        )
    if "products" in inspector.get_table_names():
        product_columns = {
            column["name"] for column in inspector.get_columns("products")
        }
        if "merchant_id" not in product_columns:
            statements.append("ALTER TABLE products ADD COLUMN merchant_id VARCHAR")
    if "audit_logs" in inspector.get_table_names():
        audit_columns = {
            column["name"] for column in inspector.get_columns("audit_logs")
        }
        if "user_id" not in audit_columns:
            statements.append("ALTER TABLE audit_logs ADD COLUMN user_id VARCHAR")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
