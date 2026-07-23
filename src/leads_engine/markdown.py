from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$")
URL_RE = re.compile(r"https?://[^\s<>`\])]+", re.IGNORECASE)
ANGLE_URL_RE = re.compile(r"<(https?://[^>]+)>", re.IGNORECASE)

SOCIAL_HOSTS = {
    "facebook.com",
    "fb.com",
    "instagram.com",
    "linkedin.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
}


@dataclass(frozen=True, slots=True)
class CrawlTarget:
    url: str
    section: str

    @property
    def host(self) -> str:
        return host_for_url(self.url)


def host_for_url(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


def is_social_host(host: str) -> bool:
    return any(host == social or host.endswith(f".{social}") for social in SOCIAL_HOSTS)


def _line_urls(line: str) -> list[str]:
    angle_urls = ANGLE_URL_RE.findall(line)
    without_angles = ANGLE_URL_RE.sub("", line)
    bare_urls = URL_RE.findall(without_angles)
    return [url.rstrip(".,;:!?") for url in [*angle_urls, *bare_urls]]


def extract_targets(
    path: Path,
    *,
    sections: set[str] | None = None,
    all_sections: bool = False,
    include_social_targets: bool = False,
) -> list[CrawlTarget]:
    """Read Markdown URLs and retain the first original URL for each host."""
    selected = {section.casefold() for section in (sections or {"Platform"})}
    current_section = ""
    targets: list[CrawlTarget] = []
    seen_hosts: set[str] = set()

    for line in path.read_text(encoding="utf-8").splitlines():
        heading = HEADING_RE.match(line)
        if heading:
            current_section = heading.group(1).strip()
            continue

        if not all_sections and current_section.casefold() not in selected:
            continue

        for url in _line_urls(line):
            host = host_for_url(url)
            if not host or host in seen_hosts:
                continue
            if is_social_host(host) and not include_social_targets:
                continue
            seen_hosts.add(host)
            targets.append(CrawlTarget(url=url, section=current_section))

    return targets

