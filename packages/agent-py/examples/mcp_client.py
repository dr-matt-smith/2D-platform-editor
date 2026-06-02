"""Minimal MCP stdio client for the agent-py server.

    pip install -e ".[mcp]"            # from packages/agent-py
    python3 packages/agent-py/examples/mcp_client.py

Spawns `python -m agent_mcp` over stdio, lists its tools, asks it to solve a
level, then replays the returned recording through simulate_recording to
confirm the win — all through the protocol, no in-process shortcuts.
"""

import asyncio
import json
import sys
from pathlib import Path

SRC = str(Path(__file__).resolve().parent.parent / "src")

from mcp.client.session import ClientSession  # noqa: E402
from mcp.client.stdio import StdioServerParameters, stdio_client  # noqa: E402

LEVEL = "# pickup-required: all\n.......\n#P.o.E#\n#######"


def _data(result):
    """Pull the JSON payload out of a CallToolResult (text content)."""
    return json.loads(result.content[0].text)


async def main():
    params = StdioServerParameters(
        command=sys.executable, args=["-m", "agent_mcp"], env={"PYTHONPATH": SRC}
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("tools:", [t.name for t in tools.tools])

            solved = _data(await session.call_tool("solve_level", {"level": LEVEL}))
            if not solved["ok"]:
                print("FAIL: no solution —", solved.get("reason"))
                return 1
            sol = solved["solutions"][0]
            print(f"solved: {len(sol['recording'])} events, "
                  f"frame {sol['stats']['frame']}, score {sol['stats']['score']}")
            for t in sol["trace"]:
                print("  -", t["why"])

            replay = _data(await session.call_tool(
                "simulate_recording", {"level": LEVEL, "recording": sol["recording"]}
            ))
            print("replay outcome:", replay["outcome"])
            if replay["outcome"] != "won":
                return 1
    print("OK: solved + verified a level end-to-end over MCP.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
