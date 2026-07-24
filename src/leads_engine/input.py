from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


@dataclass(frozen=True, slots=True)
class CrawlTarget:
    url: str

    @property
    def host(self) -> str:
        return host_for_url(self.url)


class InputFormatError(ValueError):
    pass


def host_for_url(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


def _validate_url(value: str) -> str | None:
    if any(character.isspace() for character in value):
        return "expected exactly one URL with no unescaped spaces"
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as error:
        return str(error)
    if parsed.scheme.casefold() not in {"http", "https"}:
        return "URL must start with http:// or https://"
    if not parsed.netloc or not parsed.hostname:
        return "URL must include a hostname"
    if parsed.username is not None or parsed.password is not None:
        return "URLs containing credentials are not allowed"
    if port is not None and not 1 <= port <= 65535:
        return "URL port must be between 1 and 65535"
    return None


def extract_targets(path: Path) -> list[CrawlTarget]:
    """Validate a one-URL-per-line text file and deduplicate by hostname."""
    targets: list[CrawlTarget] = []
    seen_hosts: set[str] = set()
    errors: list[str] = []

    if path.suffix.casefold() != ".txt":
        raise InputFormatError(f"input must be a .txt file: {path}")

    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError as error:
        raise InputFormatError(f"input file does not exist: {path}") from error
    except UnicodeDecodeError as error:
        raise InputFormatError(f"input file must be UTF-8 text: {path}") from error

    for line_number, raw_line in enumerate(lines, start=1):
        url = raw_line.strip()
        if not url:
            continue

        validation_error = _validate_url(url)
        if validation_error:
            errors.append(f"line {line_number}: {validation_error}: {url!r}")
            continue

        host = host_for_url(url)
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        targets.append(CrawlTarget(url=url))

    if errors:
        details = "\n".join(f"  - {error}" for error in errors)
        raise InputFormatError(
            f"invalid input format in {path}:\n{details}\n"
            "Each non-empty line must contain one absolute HTTP(S) URL."
        )
    if not targets:
        raise InputFormatError(
            f"input file contains no URLs: {path}. "
            "Blank lines are allowed, but at least one URL is required."
        )
    return targets
