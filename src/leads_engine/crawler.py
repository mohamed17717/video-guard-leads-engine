from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from .extract import extract_lead
from .markdown import CrawlTarget, host_for_url
from .models import Lead


CONTACT_TERMS = (
    "contact",
    "about",
    "support",
    "reach-us",
    "get-in-touch",
    "اتصل",
    "تواصل",
    "من-نحن",
    "من_نحن",
)


@dataclass(frozen=True, slots=True)
class CrawlConfig:
    source: str = "google dorks"
    default_country: str = "EG"
    concurrency: int = 6
    timeout: float = 20.0
    delay: float = 0.25
    max_pages: int = 3
    max_bytes: int = 2_000_000
    respect_robots: bool = True
    user_agent: str = "VideoGuardLeadsBot/0.1 (+public contact discovery)"


class CrawlFailure(RuntimeError):
    pass


def _short_error(error: Exception) -> str:
    message = re.sub(r"\s+", " ", str(error)).strip()
    return f"{type(error).__name__}: {message}"[:300]


async def _read_html(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_bytes: int,
) -> tuple[str, str]:
    async with client.stream("GET", url) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").casefold()
        if content_type and "html" not in content_type and "xhtml" not in content_type:
            raise CrawlFailure(f"unsupported content type: {content_type}")

        body = bytearray()
        async for chunk in response.aiter_bytes():
            remaining = max_bytes - len(body)
            if remaining <= 0:
                break
            body.extend(chunk[:remaining])

        encoding = response.encoding or "utf-8"
        return str(response.url), body.decode(encoding, errors="replace")


async def _robots_allows(
    client: httpx.AsyncClient,
    url: str,
    user_agent: str,
) -> bool:
    parsed = urlsplit(url)
    robots_url = urlunsplit((parsed.scheme, parsed.netloc, "/robots.txt", "", ""))
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        response = await client.get(robots_url)
        if response.status_code >= 400:
            return True
        parser.parse(response.text.splitlines())
        return parser.can_fetch(user_agent, url)
    except httpx.HTTPError:
        return True


def _contact_links(page_url: str, html: str, host: str, limit: int) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "").strip()
        label = anchor.get_text(" ", strip=True).casefold()
        absolute = urljoin(page_url, href)
        parsed = urlsplit(absolute)
        haystack = f"{parsed.path.casefold()} {label}"
        if parsed.scheme not in {"http", "https"}:
            continue
        if host_for_url(absolute) != host:
            continue
        if not any(term in haystack for term in CONTACT_TERMS):
            continue
        clean = parsed._replace(query="", fragment="").geturl()
        if clean not in links and clean != page_url:
            links.append(clean)
        if len(links) >= limit:
            break
    return links


async def crawl_target(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    target: CrawlTarget,
    config: CrawlConfig,
) -> Lead:
    pages: list[tuple[str, str]] = []
    error_message = ""

    try:
        async with semaphore:
            if config.respect_robots and not await _robots_allows(
                client, target.url, config.user_agent
            ):
                raise CrawlFailure("blocked by robots.txt")
            await asyncio.sleep(config.delay)
            page_url, html = await _read_html(
                client, target.url, max_bytes=config.max_bytes
            )
        pages.append((page_url, html))

        contact_links = _contact_links(
            page_url,
            html,
            target.host,
            max(config.max_pages - 1, 0),
        )
        for contact_url in contact_links:
            try:
                async with semaphore:
                    if config.respect_robots and not await _robots_allows(
                        client, contact_url, config.user_agent
                    ):
                        continue
                    await asyncio.sleep(config.delay)
                    pages.append(
                        await _read_html(client, contact_url, max_bytes=config.max_bytes)
                    )
            except (httpx.HTTPError, CrawlFailure):
                continue
    except (httpx.HTTPError, CrawlFailure, UnicodeError) as error:
        error_message = _short_error(error)

    return extract_lead(
        target.url,
        pages,
        source=config.source,
        default_country=config.default_country,
        crawl_error=error_message,
    )


async def crawl_targets(
    targets: list[CrawlTarget],
    config: CrawlConfig,
):
    semaphore = asyncio.Semaphore(config.concurrency)
    timeout = httpx.Timeout(config.timeout)
    headers = {
        "User-Agent": config.user_agent,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.8",
    }
    async with httpx.AsyncClient(
        timeout=timeout,
        headers=headers,
        follow_redirects=True,
    ) as client:
        tasks = [
            asyncio.create_task(crawl_target(client, semaphore, target, config))
            for target in targets
        ]
        for completed in asyncio.as_completed(tasks):
            yield await completed

