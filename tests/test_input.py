from pathlib import Path

import pytest

from leads_engine.input import InputFormatError, extract_targets


def test_extracts_urls_skips_empty_lines_and_deduplicates_hosts(
    tmp_path: Path,
) -> None:
    source = tmp_path / "leads.txt"
    source.write_text(
        """\
https://www.example.com/course/1

https://example.com/course/2
https://www.instagram.com/example/
https://school.example.org/
""",
        encoding="utf-8",
    )

    targets = extract_targets(source)

    assert [target.host for target in targets] == [
        "example.com",
        "instagram.com",
        "school.example.org",
    ]
    assert targets[0].url == "https://www.example.com/course/1"


def test_rejects_every_invalid_non_empty_line_before_returning(tmp_path: Path) -> None:
    source = tmp_path / "leads.txt"
    source.write_text(
        """\
https://valid.example/
not-a-url
https://two.example/ another-value
ftp://files.example/
""",
        encoding="utf-8",
    )

    with pytest.raises(InputFormatError) as caught:
        extract_targets(source)

    message = str(caught.value)
    assert "line 2" in message
    assert "line 3" in message
    assert "line 4" in message
    assert "Each non-empty line must contain one absolute HTTP(S) URL." in message


def test_rejects_file_with_only_empty_lines(tmp_path: Path) -> None:
    source = tmp_path / "leads.txt"
    source.write_text("\n  \n\t\n", encoding="utf-8")

    with pytest.raises(InputFormatError, match="contains no URLs"):
        extract_targets(source)


def test_rejects_non_txt_input(tmp_path: Path) -> None:
    source = tmp_path / "leads.md"
    source.write_text("https://example.com/\n", encoding="utf-8")

    with pytest.raises(InputFormatError, match=r"must be a \.txt file"):
        extract_targets(source)
