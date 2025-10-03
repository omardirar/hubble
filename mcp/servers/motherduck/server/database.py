import logging
from typing import Optional
from urllib.parse import parse_qsl, urlencode

import duckdb
from tabulate import tabulate

from .auth import MotherDuckAuthContext
from .configs import SERVER_VERSION, resolve_motherduck_token

logger = logging.getLogger("mcp_server_motherduck")


class DatabaseClient:
    """Executes MotherDuck queries using short-lived DuckDB connections."""

    def __init__(
        self,
        db_path: str | None = None,
        motherduck_token: str | None = None,
        saas_mode: bool = False,
    ) -> None:
        self._default_connection = db_path if db_path and db_path.startswith("md:") else None
        self._default_token = motherduck_token
        self._saas_mode = saas_mode

    def _default_credentials(self) -> Optional[MotherDuckAuthContext]:
        if not self._default_connection:
            return None
        token = self._default_token or resolve_motherduck_token()
        return MotherDuckAuthContext(
            service_secret=token,
            connection_uri=self._default_connection,
        )

    @staticmethod
    def _format_results(cursor: duckdb.DuckDBPyConnection) -> str:
        if cursor.description is None:
            return "Query executed successfully."
        headers = [f"{col[0]}\n{col[1]}" for col in cursor.description]
        return tabulate(cursor.fetchall(), headers=headers, tablefmt="pretty")

    def _build_remote_dsn(self, credentials: MotherDuckAuthContext) -> str:
        base, _, query_string = credentials.connection_uri.partition("?")
        if not base.startswith("md:"):
            raise ValueError("Unsupported MotherDuck connection string")

        params = dict(parse_qsl(query_string, keep_blank_values=True))
        params["motherduck_token"] = credentials.service_secret
        if self._saas_mode:
            params.setdefault("saas_mode", "true")

        encoded = urlencode(params)
        return f"{base}?{encoded}" if encoded else base

    def query(
        self,
        query: str,
        credentials: Optional[MotherDuckAuthContext] = None,
    ) -> str:
        creds = credentials or self._default_credentials()
        if creds is None:
            raise ValueError("MotherDuck credentials were not provided")

        dsn = self._build_remote_dsn(creds)
        logger.info("Executing query against MotherDuck target %s", creds.display_target)
        conn = duckdb.connect(
            dsn,
            config={"custom_user_agent": f"mcp-server-motherduck/{SERVER_VERSION}"},
            read_only=True,
        )
        try:
            cursor = conn.execute(query)
            return self._format_results(cursor)
        finally:
            try:
                conn.close()
            except Exception:
                pass
