from pathlib import Path

from leads_engine.markdown import extract_targets


def test_extracts_platform_urls_and_deduplicates_hosts(tmp_path: Path) -> None:
    source = tmp_path / "leads.md"
    source.write_text(
        """\
## Platform
- <https://www.example.com/course/1>
- <https://example.com/course/2>
- <https://www.instagram.com/example/>
- https://school.example.org/

## Related
- <https://related.example.net/>
""",
        encoding="utf-8",
    )

    targets = extract_targets(source)

    assert [target.host for target in targets] == ["example.com", "school.example.org"]
    assert targets[0].url == "https://www.example.com/course/1"


def test_can_include_all_sections(tmp_path: Path) -> None:
    source = tmp_path / "leads.md"
    source.write_text(
        "## Platform\n<https://one.example/>\n## Related\n<https://two.example/>\n",
        encoding="utf-8",
    )

    targets = extract_targets(source, all_sections=True)

    assert [target.host for target in targets] == ["one.example", "two.example"]

