# motherduck/app.py
import contextlib
from collections.abc import AsyncIterator
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from .asgi import HeaderCaptureApp
from .server import configure_runtime_context, get_motherduck_server


def create_app(
    *,
    db_path: str | None = None,
    motherduck_token: str | None = None,
    saas_mode: bool = False,
) -> Starlette:
    server = get_motherduck_server()
    configure_runtime_context(
        db_path=db_path,
        motherduck_token=motherduck_token,
        saas_mode=saas_mode,
    )

    @contextlib.asynccontextmanager
    async def lifespan(app: Any) -> AsyncIterator[None]:
        async with server.session_manager.run():
            yield

    async def health(_request: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "motherduck"})

    return Starlette(
        routes=[
            Route("/health", health),
            Mount(
                "/",
                app=HeaderCaptureApp(
                    server.streamable_http_app(),
                    default_headers=None,
                ),
            ),
        ],
        lifespan=lifespan,
    )


app: Starlette = create_app()
