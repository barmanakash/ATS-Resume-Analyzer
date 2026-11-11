from typing import Optional

from fastapi import APIRouter, Depends, Request, Response

from app.config import settings
from app.core.exceptions import BadRequestError
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, VerifyEmailRequest
from app.schemas.common import ok
from app.schemas.user import to_public_user
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _refresh_cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
        "max_age": settings.refresh_token_expire_days * 86400,
        "domain": settings.cookie_domain or None,
    }


def get_auth_service() -> AuthService:
    return AuthService(get_db())


@router.post("/register")
async def register(
    payload: RegisterRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.register(payload.fullName, payload.email, payload.password)
    response.status_code = 201
    return ok({"message": "Registration successful. Please verify your email before logging in."})


@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    user, access_token, refresh_token = await auth_service.login(
        payload.email,
        payload.password,
        user_agent=request.headers.get("user-agent"),
    )
    response.set_cookie("refresh_token", refresh_token, **_refresh_cookie_kwargs())
    return ok({"accessToken": access_token, "user": to_public_user(user)})


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    refresh_token = request.cookies.get("refresh_token")
    access_token, new_refresh_token = await auth_service.refresh(
        refresh_token,
        user_agent=request.headers.get("user-agent"),
    )
    response.set_cookie("refresh_token", new_refresh_token, **_refresh_cookie_kwargs())
    return ok({"accessToken": access_token})


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    refresh_token = request.cookies.get("refresh_token")
    await auth_service.logout(refresh_token)
    response.delete_cookie("refresh_token", path="/", domain=settings.cookie_domain or None)
    return ok({"message": "Logged out successfully."})


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return ok(to_public_user(current_user))


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.forgot_password(payload.email)
    return ok({"message": "If an account exists for this email, a password reset link has been sent."})


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.reset_password(payload.token, payload.newPassword)
    return ok({"message": "Password reset complete. Please log in with your new password."})


@router.post("/verify-email")
async def verify_email(
    payload: VerifyEmailRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.verify_email(payload.token)
    return ok({"message": "Your email has been verified successfully."})
