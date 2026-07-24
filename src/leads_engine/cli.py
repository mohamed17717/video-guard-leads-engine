from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path

from .crawler import CrawlConfig, crawl_targets
from .input import InputFormatError, extract_targets
from .models import CSV_FIELDS


def _existing_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


async def _run(args: argparse.Namespace) -> int:
    targets = extract_targets(args.input)
    if args.limit:
        targets = targets[: args.limit]

    if args.dry_run:
        for target in targets:
            print(f"{target.host}\t{target.url}")
        print(f"\n{len(targets)} unique domains")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    old_rows = [] if args.refresh else _existing_rows(args.output)
    retained_rows: list[dict[str, str]] = []
    rewrite_output = args.refresh or not args.output.exists()

    if args.retry_errors and not args.refresh:
        failed_names = {
            row.get("name", "")
            for row in old_rows
            if "crawl_error:" in row.get("notes", "")
        }
        targets = [target for target in targets if target.host in failed_names]
        retried_names = {target.host for target in targets}
        retained_rows = [
            row for row in old_rows if row.get("name", "") not in retried_names
        ]
        rewrite_output = True
    elif not args.refresh:
        existing_names = {row.get("name", "") for row in old_rows}
        targets = [target for target in targets if target.host not in existing_names]

    if not targets:
        print("Nothing to crawl; all selected domains already exist in the CSV.")
        return 0

    config = CrawlConfig(
        source=args.source,
        default_country=args.default_country.upper(),
        concurrency=args.concurrency,
        timeout=args.timeout,
        delay=args.delay,
        max_pages=args.max_pages,
        max_bytes=args.max_bytes,
        respect_robots=not args.ignore_robots,
        user_agent=args.user_agent,
    )

    mode = "w" if rewrite_output else "a"
    with args.output.open(mode, newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        if mode == "w":
            writer.writeheader()
            for row in retained_rows:
                writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})
        total = len(targets)
        completed = 0
        async for lead in crawl_targets(targets, config):
            writer.writerow(lead.to_row())
            handle.flush()
            completed += 1
            status = "error" if "crawl_error:" in lead.notes else "ok"
            print(f"[{completed}/{total}] {status:5} {lead.name}", file=sys.stderr)

    print(f"Wrote {len(targets)} leads to {args.output}")
    return 0


def _positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="leads-engine",
        description="Crawl public contact details from a one-URL-per-line text file.",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="UTF-8 text file containing exactly one HTTP(S) URL per non-empty line",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("leads.csv"),
        help="destination CSV (default: leads.csv)",
    )
    parser.add_argument("--source", default="google dorks")
    parser.add_argument("--default-country", default="EG", help="ISO-2 fallback")
    parser.add_argument("--concurrency", type=_positive_int, default=6)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--max-pages", type=_positive_int, default=3)
    parser.add_argument("--max-bytes", type=_positive_int, default=2_000_000)
    parser.add_argument(
        "--user-agent",
        default="VideoGuardLeadsBot/0.1 (+public contact discovery)",
    )
    parser.add_argument(
        "--ignore-robots",
        action="store_true",
        help="ignore robots.txt (use only when you have permission)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="replace the output CSV and crawl every selected domain again",
    )
    parser.add_argument(
        "--retry-errors",
        action="store_true",
        help="retry rows whose notes contain crawl_error",
    )
    parser.add_argument("--limit", type=_positive_int)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="list selected domains without making network requests",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        raise SystemExit(asyncio.run(_run(args)))
    except InputFormatError as error:
        parser.error(str(error))
    except KeyboardInterrupt:
        print("\nStopped; completed rows are already saved.", file=sys.stderr)
        raise SystemExit(130) from None
