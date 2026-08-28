from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

# pyrefly: ignore [missing-import]
from app import models, schemas
# pyrefly: ignore [missing-import]
from app.database import get_db
from app.core.security import get_current_active_user

router = APIRouter(
    prefix="/api/v1/products",
    tags=["products"]
)

@router.get("/", response_model=List[schemas.Product])
def read_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).filter(models.Product.is_active == True)
    
    if category:
        query = query.filter(models.Product.category == category)
        
    products = query.offset(skip).limit(limit).all()
    return products

@router.get("/search", response_model=List[schemas.Product])
def search_products(
    q: str = Query(..., min_length=1, description="Search query for product name or description"),
    db: Session = Depends(get_db)
):
    search_term = f"%{q}%"
    products = db.query(models.Product).filter(
        models.Product.is_active == True,
        or_(
            models.Product.name.ilike(search_term),
            models.Product.description.ilike(search_term)
        )
    ).all()
    return products

@router.get("/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/", response_model=schemas.Product, status_code=201)
def create_product(
    product: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    merchant_id = current_user.id if current_user.role == "merchant" else None
    db_product = models.Product(**product.model_dump(), merchant_id=merchant_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product
