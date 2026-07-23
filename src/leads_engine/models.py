from __future__ import annotations

from dataclasses import asdict, dataclass


CSV_FIELDS = [
    "name",
    "company_name",
    "phone",
    "whatsapp",
    "email",
    "website",
    "social_url",
    "country",
    "source",
    "notes",
    "date",
]


@dataclass(slots=True)
class Lead:
    name: str
    company_name: str
    phone: str
    whatsapp: str
    email: str
    website: str
    social_url: str
    country: str
    source: str
    notes: str
    date: str

    def to_row(self) -> dict[str, str]:
        return asdict(self)

