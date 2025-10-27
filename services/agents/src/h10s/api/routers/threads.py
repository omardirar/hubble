"""Threads and messages router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from h10s.api.deps import get_interactions_repo, require_auth
from h10s.db.repositories import InteractionsRepository
from h10s.schema import (
    CreateMessageRequest,
    CreateThreadRequest,
    CreateThreadResponse,
    MessageResponse,
    MessagesListResponse,
    ThreadResponse,
)
from h10s.schema.domain import AuthContext

router = APIRouter(prefix="/api/v1", tags=["threads"])


@router.post("/threads", response_model=CreateThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    request: CreateThreadRequest,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
) -> CreateThreadResponse:
    """Create a new thread."""
    thread = await repo.create_thread(
        org_id=auth.org_id,
        owner_user_id=auth.user_id,
        title=request.title,
        metadata=request.metadata,
    )
    return CreateThreadResponse(
        id=thread["id"], title=thread["title"], created_at=thread["created_at"]
    )


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: UUID,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
) -> ThreadResponse:
    """Get thread by ID."""
    thread = await repo.get_thread(thread_id, auth.org_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    return ThreadResponse(**thread)


@router.get("/threads/{thread_id}/messages", response_model=MessagesListResponse)
async def get_thread_messages(
    thread_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    before: UUID | None = Query(default=None),
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
) -> MessagesListResponse:
    """Get messages for a thread."""
    # Verify thread exists and user has access
    thread = await repo.get_thread(thread_id, auth.org_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    messages = await repo.get_messages(thread_id, auth.org_id, limit=limit, before_id=before)
    return MessagesListResponse(
        messages=[MessageResponse(**msg) for msg in messages], has_more=len(messages) == limit
    )


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    thread_id: UUID,
    request: CreateMessageRequest,
    auth: AuthContext = Depends(require_auth),
    repo: InteractionsRepository = Depends(get_interactions_repo),
) -> MessageResponse:
    """Add a message to a thread."""
    # Verify thread exists
    thread = await repo.get_thread(thread_id, auth.org_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    message = await repo.create_message(
        thread_id=thread_id,
        org_id=auth.org_id,
        role=request.role,
        content=request.content,
        author_user_id=auth.user_id,
    )
    return MessageResponse(**message)
