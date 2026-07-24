import asyncio
import csv
from datetime import date
from pathlib import Path

import pytest

from leads_engine import cli
from leads_engine.input import InputFormatError
from leads_engine.models import CSV_FIELDS, Lead


def _row(name: str, notes: str = "") -> dict[str, str]:
    return Lead(
        name=name,
        company_name=name,
        phone="",
        whatsapp="",
        email="",
        website=f"https://{name}/",
        social_url="",
        country="EG",
        source="google dorks",
        notes=notes,
        date=date.today().isoformat(),
    ).to_row()


def test_retry_errors_replaces_selected_failures_only(
    tmp_path: Path, monkeypatch
) -> None:
    input_file = tmp_path / "leads.txt"
    input_file.write_text(
        """\
https://success.example/
https://retry.example/
https://new.example/
""",
        encoding="utf-8",
    )
    output = tmp_path / "leads.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerow(_row("success.example"))
        writer.writerow(_row("retry.example", "crawl_error: timeout"))
        writer.writerow(_row("related.example", "crawl_error: blocked"))

    async def fake_crawl(targets, config):
        assert [target.host for target in targets] == ["retry.example"]
        yield Lead(**_row("retry.example"))

    monkeypatch.setattr(cli, "crawl_targets", fake_crawl)
    args = cli.build_parser().parse_args(
        [str(input_file), "--output", str(output), "--retry-errors"]
    )

    assert asyncio.run(cli._run(args)) == 0

    with output.open(newline="", encoding="utf-8-sig") as handle:
        rows = {row["name"]: row for row in csv.DictReader(handle)}
    assert set(rows) == {"success.example", "retry.example", "related.example"}
    assert rows["retry.example"]["notes"] == ""
    assert "crawl_error:" in rows["related.example"]["notes"]


def test_invalid_input_stops_before_output_is_created(tmp_path: Path) -> None:
    input_file = tmp_path / "invalid.txt"
    input_file.write_text(
        "https://valid.example/\nthis is not a URL\n",
        encoding="utf-8",
    )
    output = tmp_path / "must-not-exist.csv"
    args = cli.build_parser().parse_args(
        [str(input_file), "--output", str(output)]
    )

    with pytest.raises(InputFormatError, match="line 2"):
        asyncio.run(cli._run(args))

    assert not output.exists()
