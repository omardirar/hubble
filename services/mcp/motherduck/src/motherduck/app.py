# motherduck/app.py
import contextlib
from collections.abc import AsyncIterator
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from .asgi import HeaderCaptureApp
from .server import get_motherduck_lifespan, get_motherduck_server


def create_app() -> Starlette:
    server = get_motherduck_server()

    @contextlib.asynccontextmanager
    async def lifespan(app: Any) -> AsyncIterator[None]:
        async with (
            get_motherduck_lifespan(None, None, False) as _,
            server.session_manager.run(),
        ):
            yield

    async def health(_request: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "motherduck"})

    return Starlette(
        routes=[
            Route("/health", health),
            Mount("/", app=HeaderCaptureApp(server.streamable_http_app())),
        ],
        lifespan=lifespan,
    )


app: Starlette = create_app()
