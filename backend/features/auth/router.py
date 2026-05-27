from fastapi import APIRouter, Depends

from core.dependencies import get_current_user
from features.auth.schemas import UserProfile

router = APIRouter()


@router.get("/me", response_model=UserProfile)
async def get_me(user=Depends(get_current_user)):
    meta = user.user_metadata or {}
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=meta.get("full_name") or meta.get("name"),
        avatar_url=meta.get("avatar_url") or meta.get("picture"),
    )
