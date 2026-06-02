"""agent_mcp — an MCP server exposing the Python planning agent to other
agents.

Wraps agent_planner (which drives agent_adapter's standalone physics port)
behind Model Context Protocol tools: paste a level, get back a solving input
recording. This is the v29 "open the webapp to other agents" item — a level
in, a verified recording out, no engine coupling on the caller's side.

Run the server over stdio:

    python -m agent_mcp

(after `pip install -e ".[mcp]"` from packages/agent-py, or with
PYTHONPATH=src for a no-install dev run).
"""

from .server import mcp

__all__ = ["mcp"]
