from leads_engine.extract import extract_lead


HTML = """
<html>
  <body>
    <a href="https://wa.me/201001234567">WhatsApp</a>
    <a href="tel:+20 11 9876 5432">Call us</a>
    <a href="mailto:HELLO@Example.com">Email</a>
    <a href="mailto:sales@example.com">Sales</a>
    <a href="https://instagram.com/example.academy/?utm_source=site">Instagram</a>
    <a href="https://facebook.com/example.academy">Facebook</a>
  </body>
</html>
"""


def test_extracts_requested_csv_fields() -> None:
    lead = extract_lead(
        "https://www.example.com/course/42?ref=google",
        [("https://www.example.com/course/42?ref=google", HTML)],
        source="google dorks",
        default_country="EG",
    )

    assert lead.name == "example.com"
    assert lead.company_name == "example.com"
    assert lead.phone == "+201001234567"
    assert lead.whatsapp == lead.phone
    assert lead.email == "hello@example.com"
    assert lead.website == "https://www.example.com/course/42?ref=google"
    assert lead.social_url == "https://instagram.com/example.academy"
    assert lead.country == "EG"
    assert lead.source == "google dorks"
    assert "+201198765432" in lead.notes
    assert "facebook" in lead.notes
    assert lead.date

