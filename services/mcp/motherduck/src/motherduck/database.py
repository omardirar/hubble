import contextlib
import logging
import time
from typing import TYPE_CHECKING
from urllib.parse import parse_qsl, urlencode

import duckdb
from tabulate import tabulate

if TYPE_CHECKING:  # pragma: no cover - import only needed for typing
    import pyarrow as pa  # type: ignore[import-untyped]

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

    def _default_credentials(self) -> MotherDuckAuthContext | None:
        if not self._default_connection:
            return None
        token = self._default_token or resolve_motherduck_token()
        # Extract org_id from default connection (format: md:md_org_123)
        db_name = self._default_connection.replace("md:", "", 1)
        org_id = db_name[3:] if db_name.startswith("md_") else "unknown"
        return MotherDuckAuthContext(
            org_id=org_id,
            user_id="system",
            service_secret=token,
        )

    @staticmethod
    def _format_results(cursor: duckdb.DuckDBPyConnection) -> tuple[str, int]:
        if cursor.description is None:
            return "Query executed successfully.", 0

        rows = cursor.fetchall()
        headers = [f"{col[0]}\n{col[1]}" for col in cursor.description]
        formatted = tabulate(rows, headers=headers, tablefmt="pretty")
        return formatted, len(rows)

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
        credentials: MotherDuckAuthContext | None = None,
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
            start = time.perf_counter()
            cursor = conn.execute(query)
            formatted, row_count = self._format_results(cursor)
            duration_ms = (time.perf_counter() - start) * 1000

            metadata_lines = [f"Rows: {row_count}", f"Duration: {duration_ms:.2f} ms"]
            if formatted:
                return "\n\n".join([formatted, "\n".join(metadata_lines)])
            return "\n".join(metadata_lines)
        finally:
            with contextlib.suppress(Exception):
                conn.close()

    def fetch_arrow_table(
        self,
        query: str,
        credentials: MotherDuckAuthContext | None = None,
    ) -> tuple["pa.Table", float]:
        creds = credentials or self._default_credentials()
        if creds is None:
            raise ValueError("MotherDuck credentials were not provided")

        dsn = self._build_remote_dsn(creds)
        logger.info(
            "Fetching Arrow table for query against MotherDuck target %s",
            creds.display_target,
        )

        conn = duckdb.connect(
            dsn,
            config={"custom_user_agent": f"mcp-server-motherduck/{SERVER_VERSION}"},
            read_only=True,
        )
        try:
            # Local import to avoid mandatory dependency at import time
            import pyarrow as pa

            start = time.perf_counter()
            cursor = conn.execute(query)
            table = cursor.fetch_arrow_table()
            duration_ms = (time.perf_counter() - start) * 1000
            if not isinstance(table, pa.Table):
                raise TypeError("DuckDB did not return a pyarrow.Table result")
            return table, duration_ms
        finally:
            with contextlib.suppress(Exception):
                conn.close()
