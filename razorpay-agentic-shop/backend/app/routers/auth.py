from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import (
    create_access_token,
    get_current_active_user,
    hash_password,
    verify_password,
)
from app.database import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _auth_response(user: models.User) -> schemas.AuthResponse:
    token = create_access_token(
        {"sub": user.id, "email": user.email, "role": user.role}
    )
    return schemas.AuthResponse(
        access_token=token,
        user=user,
    )


@router.post(
    "/signup",
    response_model=schemas.AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    """Create a customer account and return its access token."""
    existing_user = (
        db.query(models.User).filter(models.User.email == payload.email).first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="customer",
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from exc
    db.refresh(user)
    return _auth_response(user)


@router.post("/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user with email and password."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if (
        user is None
        or user.hashed_password is None
        or not verify_password(payload.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return _auth_response(user)


@router.get("/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(get_current_active_user)):
    """Return the currently authenticated active user."""
    return current_user
