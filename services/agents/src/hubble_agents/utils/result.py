"""Result pattern for consistent error handling"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Exception)


@dataclass
class Result[T]:
    """Result type for operations that can fail.

    Simpler variant: error is stored as Exception | None.
    """

    _value: T | None = None
    _error: Exception | None = None

    @staticmethod
    def ok(value: T) -> "Result[T]":
        return Result(_value=value, _error=None)

    @staticmethod
    def err(error: Exception) -> "Result[T]":
        return Result(_value=None, _error=error)

    def is_ok(self) -> bool:
        return self._error is None

    def is_error(self) -> bool:
        return self._error is not None

    def value(self) -> T:
        if self._error is not None or self._value is None:
            raise self._error or ValueError("No value in error result")
        return self._value

    def error(self) -> Exception:
        if self._error is None:
            raise ValueError("No error in successful result")
        return self._error

    def map(self, func: Callable[[T], T]) -> "Result[T]":
        if self.is_ok() and self._value is not None:
            try:
                return Result.ok(func(self._value))
            except Exception as e:
                return Result.err(e)
        return Result.err(self._error or Exception("Unknown error"))

    def and_then(self, func: Callable[[T], "Result[T]"]) -> "Result[T]":
        if self.is_ok() and self._value is not None:
            return func(self._value)
        return Result.err(self._error or Exception("Unknown error"))

    def unwrap_or(self, default: T) -> T:
        return self._value if self.is_ok() and self._value is not None else default

    def unwrap_or_else(self, func: Callable[[], T]) -> T:
        return self._value if self.is_ok() and self._value is not None else func()


# Convenience functions
def ok[T](value: T) -> Result[T]:
    return Result.ok(value)


def error_result(error: Exception) -> Result[Any]:
    return Result.err(error)


def try_catch[T](func: Callable[[], T]) -> Result[T]:
    try:
        return Result.ok(func())
    except Exception as e:
        return Result.err(e)


async def try_catch_async(func: Callable[[], Any]) -> Result[Any]:
    try:
        result = await func()
        return Result.ok(result)
    except Exception as e:
        return Result.err(e)
