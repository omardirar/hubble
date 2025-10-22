"""Database access layer."""

from .exceptions import DatabaseUnavailableError
from .supabase_client import SupabaseClient

__all__ = ["DatabaseUnavailableError", "SupabaseClient"]
