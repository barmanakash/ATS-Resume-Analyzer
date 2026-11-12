from fastapi import APIRouter, Depends, Request, Response

from app.core.cookies import clear_refresh_cookie, set_refresh_cookie
from app.core.rate_limit import rate_limit
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.schemas.common import ok
from app.schemas.user import ChangePasswordRequest, DeleteAccountRequest, UpdateProfileRequest, to_public_user
from app.services.auth_service import AuthService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def get_user_service() -> UserService:
    return UserService(get_db())


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return ok(to_public_user(current_user))


@router.patch("/me")
async def update_me(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    updated = await service.update_profile(current_user["_id"], payload.fullName)
    return ok(to_public_user(updated))


@router.post("/me/change-password", dependencies=[Depends(rate_limit("change-password", 5, 900))])
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user),
):
    access_token, refresh_token = await AuthService(get_db()).change_password(
        current_user,
        payload.currentPassword,
        payload.newPassword,
        user_agent=request.headers.get("user-agent"),
    )
    set_refresh_cookie(response, refresh_token)
    return ok({"accessToken": access_token, "message": "Password updated. Other devices have been signed out."})


@router.delete("/me/data", dependencies=[Depends(rate_limit("delete-data", 5, 3600))])
async def delete_my_data(
    payload: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    await service.delete_data(current_user, payload.password)
    return ok({"message": "All your resumes, job descriptions and analyses have been deleted."})


@router.delete("/me", dependencies=[Depends(rate_limit("delete-account", 5, 3600))])
async def delete_my_account(
    payload: DeleteAccountRequest,
    response: Response,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    await service.delete_account(current_user, payload.password)
    clear_refresh_cookie(response)
    return ok({"message": "Your account and all associated data have been deleted."})
