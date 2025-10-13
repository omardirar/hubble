"""Serialization utilities for response building"""

import base64
import hashlib
from typing import Any, Literal

import zstandard as zstd

from ...models.response_schema import FinalResponse, MessagesEnvelope


def compress_messages(messages_bytes: bytes) -> bytes:
    """Compress messages using zstandard"""
    try:
        cctx = zstd.ZstdCompressor(level=3)  # Balanced compression
        return cctx.compress(messages_bytes)
    except Exception as e:
        print(f"Error compressing messages: {e}")
        return messages_bytes


def decompress_messages(messages_bytes: bytes) -> bytes:
    """Decompress messages using zstandard"""
    try:
        dctx = zstd.ZstdDecompressor()
        return dctx.decompress(messages_bytes)
    except Exception as e:
        print(f"Error decompressing messages: {e}")
        return messages_bytes


def build_messages_envelope(result: Any, compress: bool = False) -> MessagesEnvelope:
    """Build messages envelope with bytes storage and optional compression"""
    try:
        # Get raw messages JSON bytes from PydanticAI
        if result and hasattr(result, "new_messages_json"):
            messages_bytes: bytes | str = result.new_messages_json()
        else:
            messages_bytes = b'{"messages": []}'

        if not isinstance(messages_bytes, bytes):
            messages_bytes = str(messages_bytes).encode("utf-8")

        # Validate UTF-8 encoding
        try:
            messages_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # If not valid UTF-8, encode as base64
            messages_bytes = base64.b64encode(messages_bytes)

        # Apply compression if requested
        compression: Literal["zstd"] | None = None
        if compress and len(messages_bytes) > 1024:  # Only compress if > 1KB
            messages_bytes = compress_messages(messages_bytes)
            compression = "zstd"

        # Calculate integrity fields
        sha256_hash = hashlib.sha256(messages_bytes).hexdigest()
        size_bytes = len(messages_bytes)

        return MessagesEnvelope(
            format="pydantic_ai.messages",
            encoding="utf-8",
            scope="new_run_only",
            json=messages_bytes,  # Use json alias for the field
            compression=compression,
            sha256=sha256_hash,
            size_bytes=size_bytes,
        )
    except Exception as e:
        print(f"Error building messages envelope: {e}")
        return MessagesEnvelope(
            format="pydantic_ai.messages",
            encoding="utf-8",
            scope="new_run_only",
            json=b"{}",
        )


def convert_for_json(obj: Any) -> Any:
    """Convert object to JSON-serializable format"""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    elif hasattr(obj, "dict"):
        return obj.dict()
    elif isinstance(obj, str | int | float | bool | type(None)):
        return obj
    elif isinstance(obj, list | tuple):
        return [convert_for_json(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_for_json(value) for key, value in obj.items()}
    else:
        return str(obj)


def serialize_for_file(response: FinalResponse) -> dict[str, Any]:
    """Serialize FinalResponse into a JSON-friendly dict for file export."""
    data = response.model_dump(mode="json", exclude_none=True)

    messages = data.get("messages")
    if isinstance(messages, dict):
        try:
            envelope = MessagesEnvelope.model_validate(messages)
        except Exception:
            # Leave untouched if validation fails; best effort serialization.
            pass
        else:
            data["messages"] = envelope.model_dump()

            # Ensure encoding advertises base64 when json has encoded bytes.
            encoded = data["messages"].get("json")
            if isinstance(encoded, str):
                data["messages"]["encoding"] = "base64"

    return data
