"""Audit logging utilities"""

import json
import logging
from datetime import UTC, datetime
from typing import Any

audit_logger = logging.getLogger("audit")


def log_security_event(
    event_type: str, user_id: str, org_id: str, details: dict[str, Any]
) -> None:
    """Log security events for audit trail"""
    audit_logger.info(
        json.dumps(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "event_type": event_type,
                "user_id": user_id,
                "org_id": org_id,
                "details": details,
            }
        )
    )


def log_agent_decision(agent: str, decision: str, user_id: str, org_id: str) -> None:
    """Log agent decisions for transparency"""
    log_security_event(
        "agent_decision", user_id, org_id, {"agent": agent, "decision": decision}
    )
