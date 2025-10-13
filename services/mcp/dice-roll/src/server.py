"""Dice roll MCP server using FastMCP and streamable HTTP transport"""

import logging
import random

from mcp.server.fastmcp import FastMCP

logger = logging.getLogger(__name__)

# Create FastMCP server
mcp = FastMCP("dice-roll")


# Register dice tool
@mcp.tool()
def roll_dice(count: int = 1) -> str:
    """Roll a d6 dice"""
    count = max(1, min(10, count))
    rolls = [random.randint(1, 6) for _ in range(count)]
    total = sum(rolls)
    return f"Rolled {count} dice: {rolls}\nTotal: {total}"


def main() -> None:
    """Run the MCP server"""
    import uvicorn

    app = mcp.streamable_http_app()
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")


if __name__ == "__main__":
    main()
