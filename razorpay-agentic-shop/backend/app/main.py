from fastapi import FastAPI
from . import models
from .database import engine
from .routers import products

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ecommerce Catalog API")

app.include_router(products.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Welcome to the Ecommerce Catalog API"}
