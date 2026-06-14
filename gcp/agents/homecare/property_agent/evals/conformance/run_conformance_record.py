"""
Record ADK conformance fixtures with configurable session ``user_id``.

Requires ``make conformance-web-record`` (or ``HOMEAPP_ADK_CONFORMANCE_PLUGINS=record``).

Usage:
    CONFORMANCE_USER_ID=NHnSq8V6BsWpREpm56tpCheADsr1 make conformance-record
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from google.adk.agents.run_config import StreamingMode

from google.adk.cli.conformance._generated_file_utils import load_test_case
from google.adk.cli.conformance.cli_record import _create_conformance_test_files
from google.adk.cli.conformance.test_case import TestCase

from property_agent.runtime.conformance_user import resolve_conformance_user_id

_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFORMANCE_DIR = _PACKAGE_ROOT / "property_agent" / "conformance"


async def run_record(
    paths: list[Path],
    *,
    streaming_mode: StreamingMode,
    user_id: str,
) -> int:
    click.echo("Generating ADK conformance tests...")
    click.echo(f"Session user_id: {user_id}")

    test_cases: dict[Path, TestCase] = {}
    for test_dir in paths:
        if not test_dir.exists():
            continue
        for spec_file in test_dir.rglob("spec.yaml"):
            try:
                test_case_dir = spec_file.parent
                category = test_case_dir.parent.name
                name = test_case_dir.name
                test_spec = load_test_case(test_case_dir)
                test_cases[test_case_dir] = TestCase(
                    category=category,
                    name=name,
                    dir=test_case_dir,
                    test_spec=test_spec,
                )
                click.echo(f"Loaded test spec: {category}/{name}")
            except Exception as exc:  # noqa: BLE001
                click.secho(f"Failed to load {spec_file}: {exc}", fg="red", err=True)

    if not test_cases:
        click.secho("No test specs found to process.", fg="yellow")
        return 2

    click.echo(f"\nProcessing {len(test_cases)} test cases...")
    failures = 0
    for test_case in test_cases.values():
        try:
            await _create_conformance_test_files(
                test_case,
                user_id=user_id,
                streaming_mode=streaming_mode,
            )
            click.secho(
                f"Generated conformance test files for: "
                f"{test_case.category}/{test_case.name}",
                fg="green",
            )
        except Exception as exc:  # noqa: BLE001
            failures += 1
            click.secho(
                f"Failed to generate {test_case.category}/{test_case.name}: {exc}",
                fg="red",
                err=True,
            )

    click.secho("\nConformance test generation complete!", fg="blue")
    return 1 if failures else 0


async def main(argv: list[str] | None = None) -> int:
    load_dotenv(_PACKAGE_ROOT / ".env")
    paths = [DEFAULT_CONFORMANCE_DIR]
    if argv:
        paths = [Path(p) for p in argv]
    user_id = resolve_conformance_user_id()
    return await run_record(
        paths,
        streaming_mode=StreamingMode.NONE,
        user_id=user_id,
    )


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
