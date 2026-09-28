"""
Run ADK conformance replay with AssetMem-aware session/event compare.

Requires ``make conformance-web`` on :8000.

Usage:
    make conformance-test
    CONFORMANCE_USER_ID=NHnSq8V6BsWpREpm56tpCheADsr1 make conformance-test
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from google.adk.agents.run_config import StreamingMode
from google.adk.cli.conformance import cli_test
from google.adk.cli.conformance.adk_web_server_client import AdkWebServerClient

from property_agent.evals.conformance import replay_validators
from property_agent.runtime.conformance_user import resolve_conformance_user_id

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFORMANCE_DIR = _PACKAGE_ROOT / "property_agent" / "conformance"


def _patch_replay_validators() -> None:
    cli_test.compare_events = replay_validators.compare_events
    cli_test.compare_session = replay_validators.compare_session


async def run_replay(paths: list[Path], *, user_id: str) -> int:
    _patch_replay_validators()
    click.echo("=" * 50)
    click.echo("Running ADK conformance tests in replay mode...")
    click.echo(f"Session user_id: {user_id}")
    click.echo("=" * 50)

    async with AdkWebServerClient() as client:
        runner = cli_test.ConformanceTestRunner(
            paths,
            client,
            mode="replay",
            user_id=user_id,
            streaming_mode=StreamingMode.NONE,
        )
        summary = await runner.run_all_tests()
        cli_test._print_test_summary([summary])

    if summary.failed_tests > 0:
        raise click.ClickException(f"{summary.failed_tests} test(s) failed")
    return 0


async def main(argv: list[str] | None = None) -> int:
    load_dotenv(_PACKAGE_ROOT / ".env")
    paths = [DEFAULT_CONFORMANCE_DIR]
    if argv:
        paths = [Path(p) for p in argv]
    user_id = resolve_conformance_user_id()
    try:
        return await run_replay(paths, user_id=user_id)
    except click.ClickException as exc:
        print(exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
