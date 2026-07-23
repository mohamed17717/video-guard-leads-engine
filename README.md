# VideoGuard Leads Engine

A polite, resumable crawler that reads platform URLs from Markdown and extracts
public contact data into:

```csv
name,company_name,phone,whatsapp,email,website,social_url,country,source,notes,date
```

The crawler:

- keeps the first URL from `leads.md` exactly as written in `website`;
- deduplicates websites by hostname and uses that hostname for both `name` and
  `company_name`;
- prefers a WhatsApp number, falls back to another public phone number, and
  writes the selected number to both `phone` and `whatsapp`;
- puts the primary Instagram URL in `social_url`;
- places additional phones, emails, and social accounts in `notes`;
- infers the ISO-2 country from the phone or country-code domain, then falls
  back to `--default-country`;
- records the crawl date as `YYYY-MM-DD`;
- checks `robots.txt`, limits concurrency, and saves every completed row
  immediately so interrupted runs can resume.

It only reads public HTML. It does not log in, bypass access controls, solve
CAPTCHAs, or scrape protected course content.

## Setup

```bash
cd leads_engine
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
```

## Usage

Preview the unique domains in the default `Platform` section without crawling:

```bash
leads-engine ../leads.md --dry-run
```

Crawl the default section:

```bash
leads-engine ../leads.md --output leads.csv
```

Include `Related` and `Big Players` as well:

```bash
leads-engine ../leads.md \
  --section Platform \
  --section Related \
  --section "Big Players" \
  --output leads.csv
```

Useful options:

```text
--all-sections        Crawl every section (direct social-media targets are skipped)
--retry-errors        Replace failed rows by retrying only crawl_error domains
--refresh             Replace the CSV and crawl all selected domains again
--default-country EG  Country fallback and local phone parsing region
--concurrency 6       Maximum simultaneous requests
--max-pages 3         Initial page plus likely contact/about pages
--limit 10            Small trial run
```

Existing successful domains are skipped by default. Use a small trial before
running the whole list:

```bash
leads-engine ../leads.md --limit 10 --output trial.csv
```

## Tests

```bash
pytest
```
