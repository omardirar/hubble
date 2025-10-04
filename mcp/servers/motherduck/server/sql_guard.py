from __future__ import annotations

# Guard removed for SaaS mode; file retained to avoid import errors if referenced.


class SqlGuardError(Exception):
    pass


def enforce_select_only_and_limit(sql: str, default_limit: int | None = None) -> str:
    return sql
