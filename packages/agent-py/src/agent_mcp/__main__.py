"""Run the agent-py MCP server over stdio:

    python -m agent_mcp

After `pip install -e ".[mcp]"` (from packages/agent-py) both agent_adapter
and agent_planner are importable. For a no-install dev run, put src on the
path: `PYTHONPATH=packages/agent-py/src python -m agent_mcp`.
"""

from .server import mcp


def main():
    """Console-script entry point (pyproject [project.scripts])."""
    mcp.run()


if __name__ == "__main__":
    main()
