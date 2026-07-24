from __future__ import annotations

import json
import re
from collections.abc import Iterable
from datetime import date
from typing import TypeVar
from urllib.parse import parse_qs, unquote, urlencode, urljoin, urlsplit

import phonenumbers
from bs4 import BeautifulSoup

from .input import host_for_url
from .models import Lead


EMAIL_RE = re.compile(r"[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+", re.UNICODE)
SOCIAL_DOMAINS = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "linkedin.com": "linkedin",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "tiktok.com": "tiktok",
    "twitter.com": "x",
    "x.com": "x",
    "t.me": "telegram",
    "telegram.me": "telegram",
}
COUNTRY_TLDS = {
    "ae": "AE",
    "bh": "BH",
    "dz": "DZ",
    "eg": "EG",
    "iq": "IQ",
    "jo": "JO",
    "kw": "KW",
    "lb": "LB",
    "ly": "LY",
    "ma": "MA",
    "my": "MY",
    "om": "OM",
    "ps": "PS",
    "qa": "QA",
    "sa": "SA",
    "sd": "SD",
    "sy": "SY",
    "tn": "TN",
    "tr": "TR",
    "uk": "GB",
    "ye": "YE",
}


T = TypeVar("T")


def _unique(values: Iterable[T]) -> list[T]:
    return list(dict.fromkeys(value for value in values if value))


def _social_kind(url: str) -> str | None:
    host = host_for_url(url)
    for domain, kind in SOCIAL_DOMAINS.items():
        if host == domain or host.endswith(f".{domain}"):
            return kind
    return None


def _clean_social_url(url: str, base_url: str) -> str | None:
    absolute = urljoin(base_url, url.strip())
    kind = _social_kind(absolute)
    if not kind:
        return None
    parsed = urlsplit(absolute)
    if parsed.path in {"", "/"}:
        return None
    path_parts = [part.casefold() for part in parsed.path.split("/") if part]
    if kind == "instagram":
        if path_parts[0] in {"p", "reel", "reels", "stories", "explore"}:
            return None
        parsed = parsed._replace(path=f"/{path_parts[0]}", query="", fragment="")
    elif kind == "facebook" and parsed.path.casefold().endswith("/profile.php"):
        query = parse_qs(parsed.query)
        profile_id = query.get("id", [""])[0]
        if not profile_id:
            return None
        parsed = parsed._replace(query=urlencode({"id": profile_id}), fragment="")
    else:
        sharing_paths = {
            "facebook": {"sharer.php", "share.php", "dialog"},
            "linkedin": {"sharing", "sharearticle"},
            "x": {"intent", "share"},
        }
        if path_parts and path_parts[0] in sharing_paths.get(kind, set()):
            return None
        parsed = parsed._replace(query="", fragment="")
    return parsed.geturl().rstrip("/")


def _emails_from_soup(soup: BeautifulSoup) -> list[str]:
    candidates: list[str] = []
    for anchor in soup.select('a[href^="mailto:"]'):
        address = unquote(anchor.get("href", "")[7:]).split("?", 1)[0]
        candidates.extend(EMAIL_RE.findall(address))
    candidates.extend(EMAIL_RE.findall(soup.get_text(" ", strip=True)))
    return _unique(email.casefold().strip(".,;:") for email in candidates)


def _jsonld_text(soup: BeautifulSoup) -> str:
    values: list[str] = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        values.append(json.dumps(data, ensure_ascii=False))
    return " ".join(values)


def _format_number(raw: str, default_country: str) -> tuple[str, str] | None:
    candidate = unquote(raw).strip()
    candidate = re.sub(r"^tel:", "", candidate, flags=re.I)
    candidate = candidate.split("&", 1)[0].split("?", 1)[0]
    digits = re.sub(r"\D", "", candidate)
    if candidate.startswith("+"):
        parse_value = f"+{digits}"
    elif len(digits) >= 10 and candidate.startswith(("00",)):
        parse_value = f"+{digits[2:]}"
    else:
        parse_value = candidate

    try:
        number = phonenumbers.parse(parse_value, default_country)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_possible_number(number) or not phonenumbers.is_valid_number(number):
        return None
    formatted = phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
    return formatted, phonenumbers.region_code_for_number(number) or ""


def _whatsapp_value(href: str) -> str:
    parsed = urlsplit(href)
    host = (parsed.hostname or "").casefold()
    if host == "wa.me" or host.endswith(".wa.me"):
        return parsed.path.strip("/")
    if host == "whatsapp.com" or host.endswith(".whatsapp.com"):
        return parse_qs(parsed.query).get("phone", [""])[0]
    if parsed.scheme.casefold() == "whatsapp":
        return parse_qs(parsed.query).get("phone", [""])[0]
    return ""


def _numbers_from_soup(
    soup: BeautifulSoup,
    default_country: str,
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    whatsapp: list[tuple[str, str]] = []
    phones: list[tuple[str, str]] = []

    for anchor in soup.find_all("a", href=True):
        href = anchor.get("href", "")
        if href.casefold().startswith("tel:"):
            formatted = _format_number(href, default_country)
            if formatted:
                phones.append(formatted)
        whatsapp_value = _whatsapp_value(href)
        if whatsapp_value:
            formatted = _format_number(whatsapp_value, default_country)
            if formatted:
                whatsapp.append(formatted)

    searchable_text = f"{soup.get_text(' ', strip=True)} {_jsonld_text(soup)}"
    for match in phonenumbers.PhoneNumberMatcher(searchable_text, default_country):
        if phonenumbers.is_valid_number(match.number):
            phones.append(
                (
                    phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.E164),
                    phonenumbers.region_code_for_number(match.number) or "",
                )
            )

    return _unique(whatsapp), _unique(phones)


def _country_from_host(host: str) -> str:
    labels = host.split(".")
    if not labels:
        return ""
    return COUNTRY_TLDS.get(labels[-1], "")


def extract_lead(
    original_url: str,
    pages: list[tuple[str, str]],
    *,
    source: str,
    default_country: str,
    crawl_error: str = "",
) -> Lead:
    host = host_for_url(original_url)
    all_emails: list[str] = []
    all_whatsapp: list[tuple[str, str]] = []
    all_phones: list[tuple[str, str]] = []
    socials: list[tuple[str, str]] = []

    for page_url, html in pages:
        soup = BeautifulSoup(html, "html.parser")
        all_emails.extend(_emails_from_soup(soup))
        whatsapp, phones = _numbers_from_soup(soup, default_country)
        all_whatsapp.extend(whatsapp)
        all_phones.extend(phones)
        for anchor in soup.find_all("a", href=True):
            social_url = _clean_social_url(anchor.get("href", ""), page_url)
            if social_url:
                socials.append((_social_kind(social_url) or "social", social_url))

    emails = _unique(all_emails)
    whatsapp_numbers = _unique(all_whatsapp)
    phone_numbers = _unique(all_phones)
    combined_numbers = _unique([*whatsapp_numbers, *phone_numbers])
    primary_number, primary_region = combined_numbers[0] if combined_numbers else ("", "")

    unique_socials: list[tuple[str, str]] = []
    seen_social_urls: set[str] = set()
    for item in socials:
        if item[1] not in seen_social_urls:
            seen_social_urls.add(item[1])
            unique_socials.append(item)
    instagram = next((url for kind, url in unique_socials if kind == "instagram"), "")

    notes: list[str] = []
    if len(combined_numbers) > 1:
        notes.append(f"other phones: {' | '.join(number for number, _ in combined_numbers[1:])}")
    if len(emails) > 1:
        notes.append(f"other emails: {' | '.join(emails[1:])}")
    other_socials = [
        f"{kind}: {url}"
        for kind, url in unique_socials
        if not (kind == "instagram" and url == instagram)
    ]
    if other_socials:
        notes.append(f"other socials: {' | '.join(other_socials)}")
    if crawl_error:
        notes.append(f"crawl_error: {crawl_error}")

    country = primary_region or _country_from_host(host) or default_country
    return Lead(
        name=host,
        company_name=host,
        phone=primary_number,
        whatsapp=primary_number,
        email=emails[0] if emails else "",
        website=original_url,
        social_url=instagram,
        country=country,
        source=source,
        notes="; ".join(notes),
        date=date.today().isoformat(),
    )
