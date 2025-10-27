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
            logger.debug("No default connection configured")
            return None
        token = self._default_token or resolve_motherduck_token()
        # Extract org_id from default connection (format: md:md_org_123)
        db_name = self._default_connection.replace("md:", "", 1)
        org_id = db_name[3:] if db_name.startswith("md_") else "unknown"
        logger.debug("Using default credentials for org_id=%s", org_id)
        return MotherDuckAuthContext(
            org_id=org_id,
            user_id="system",
            service_secret=token,
        )

    @staticmethod
    def _format_results(cursor: duckdb.DuckDBPyConnection) -> tuple[str, int]:
        if cursor.description is None:
            logger.debug("Query executed with no result set")
            return "Query executed successfully.", 0

        rows = cursor.fetchall()
        row_count = len(rows)
        logger.debug("Formatting %d rows with %d columns", row_count, len(cursor.description))
        headers = [f"{col[0]}\n{col[1]}" for col in cursor.description]
        formatted = tabulate(rows, headers=headers, tablefmt="pretty")
        return formatted, row_count

    def _build_remote_dsn(self, credentials: MotherDuckAuthContext) -> str:
        base, _, query_string = credentials.connection_uri.partition("?")
        if not base.startswith("md:"):
            logger.error("Invalid connection string: must start with 'md:' but got %s", base[:10])
            raise ValueError("Unsupported MotherDuck connection string")

        params = dict(parse_qsl(query_string, keep_blank_values=True))
        params["motherduck_token"] = credentials.service_secret
        if self._saas_mode:
            params.setdefault("saas_mode", "true")
            logger.debug("SaaS mode enabled for connection")

        encoded = urlencode(params)
        dsn = f"{base}?{encoded}" if encoded else base
        logger.debug("Built DSN for connection=%s saas_mode=%s", base, self._saas_mode)
        return dsn

    def query(
        self,
        query: str,
        credentials: MotherDuckAuthContext | None = None,
    ) -> str:
        creds = credentials or self._default_credentials()
        if creds is None:
            logger.error("No credentials provided for query execution")
            raise ValueError("MotherDuck credentials were not provided")

        dsn = self._build_remote_dsn(creds)
        logger.info(
            "Executing query against MotherDuck org_id=%s user_id=%s connection=%s",
            creds.org_id,
            creds.user_id,
            creds.display_target,
        )
        logger.debug("Query SQL: %s", query[:200] + ("..." if len(query) > 200 else ""))

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

            logger.info(
                "Query completed successfully rows=%d duration_ms=%.2f org_id=%s",
                row_count,
                duration_ms,
                creds.org_id,
            )

            metadata_lines = [f"Rows: {row_count}", f"Duration: {duration_ms:.2f} ms"]
            if formatted:
                return "\n\n".join([formatted, "\n".join(metadata_lines)])
            return "\n".join(metadata_lines)
        except Exception as e:
            logger.error(
                "Query execution failed org_id=%s error=%s query=%s",
                creds.org_id,
                e,
                query[:200] + ("..." if len(query) > 200 else ""),
                exc_info=True,
            )
            raise
        finally:
            logger.debug("Closing DuckDB connection")
            with contextlib.suppress(Exception):
                conn.close()

    def fetch_arrow_table(
        self,
        query: str,
        credentials: MotherDuckAuthContext | None = None,
    ) -> tuple["pa.Table", float]:
        creds = credentials or self._default_credentials()
        if creds is None:
            logger.error("No credentials provided for Arrow table fetch")
            raise ValueError("MotherDuck credentials were not provided")

        dsn = self._build_remote_dsn(creds)
        logger.info(
            "Fetching Arrow table org_id=%s user_id=%s connection=%s",
            creds.org_id,
            creds.user_id,
            creds.display_target,
        )
        logger.debug("Arrow query SQL: %s", query[:200] + ("..." if len(query) > 200 else ""))

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
                logger.error("DuckDB returned unexpected type: %s", type(table).__name__)
                raise TypeError("DuckDB did not return a pyarrow.Table result")

            logger.info(
                "Arrow table fetched successfully rows=%d columns=%d duration_ms=%.2f org_id=%s",
                table.num_rows,
                len(table.schema),
                duration_ms,
                creds.org_id,
            )

            return table, duration_ms
        except Exception as e:
            logger.error(
                "Arrow table fetch failed org_id=%s error=%s query=%s",
                creds.org_id,
                e,
                query[:200] + ("..." if len(query) > 200 else ""),
                exc_info=True,
            )
            raise
        finally:
            logger.debug("Closing DuckDB connection")
            with contextlib.suppress(Exception):
                conn.close()
