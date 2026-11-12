from fastapi import APIRouter, Depends, Request, Response

from app.core.cookies import REFRESH_COOKIE_NAME, clear_refresh_cookie, require_trusted_origin, set_refresh_cookie
from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, VerifyEmailRequest
from app.schemas.common import ok
from app.schemas.user import to_public_user
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service() -> AuthService:
    return AuthService(get_db())


@router.post("/register", dependencies=[Depends(rate_limit("register", 10, 3600))])
async def register(
    payload: RegisterRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.register(payload.fullName, payload.email, payload.password)
    response.status_code = 201
    return ok({"message": "Registration successful. Please verify your email before logging in."})


@router.post("/login", dependencies=[Depends(rate_limit("login", 10, 300))])
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
    set_refresh_cookie(response, refresh_token)
    return ok({"accessToken": access_token, "user": to_public_user(user)})


@router.post("/refresh", dependencies=[Depends(rate_limit("refresh", 60, 60)), Depends(require_trusted_origin)])
async def refresh(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    access_token, new_refresh_token = await auth_service.refresh(
        request.cookies.get(REFRESH_COOKIE_NAME),
        user_agent=request.headers.get("user-agent"),
    )
    set_refresh_cookie(response, new_refresh_token)
    return ok({"accessToken": access_token})


@router.post("/logout", dependencies=[Depends(require_trusted_origin)])
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.logout(request.cookies.get(REFRESH_COOKIE_NAME))
    clear_refresh_cookie(response)
    return ok({"message": "Logged out successfully."})


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return ok(to_public_user(current_user))


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot-password", 5, 3600))])
async def forgot_password(
    payload: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.forgot_password(payload.email)
    return ok({"message": "If an account exists for this email, a password reset link has been sent."})


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset-password", 10, 3600))])
async def reset_password(
    payload: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.reset_password(payload.token, payload.newPassword)
    return ok({"message": "Password reset complete. Please log in with your new password."})


@router.post("/verify-email", dependencies=[Depends(rate_limit("verify-email", 20, 3600))])
async def verify_email(
    payload: VerifyEmailRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    await auth_service.verify_email(payload.token)
    return ok({"message": "Your email has been verified successfully."})
