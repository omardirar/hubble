"""Structured logging utilities"""

import logging
from typing import Any


def get_logger(name: str) -> logging.Logger:
    """Get structured logger"""
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger


def log_structured(
    logger: logging.Logger, level: int, message: str, extra: dict[str, Any]
) -> None:
    """Log structured data"""
    logger.log(level, message, extra=extra)
