import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeExtractedData,
  normalizeEmail,
  normalizeEmails,
  normalizeExternalLinks,
  normalizePhoneNumber,
  normalizePhoneNumbers,
  normalizeSocialPlatform,
  normalizeUrl,
  normalizeUrls
} from "../services/normalizer.js";

test("normalizes equivalent Egyptian mobile formats", () => {
  const equivalentNumbers = [
    "01012345678",
    "201012345678",
    "+201012345678",
    "00201012345678"
  ];

  for (const number of equivalentNumbers) {
    assert.equal(
      normalizePhoneNumber(number).normalized,
      "+201012345678"
    );
  }
});

test("preserves the raw phone value while removing display formatting", () => {
  assert.deepEqual(normalizePhoneNumber("010 1234-5678"), {
    raw: "010 1234-5678",
    normalized: "+201012345678"
  });

  assert.deepEqual(normalizePhoneNumber("+966 (50) 123-4567"), {
    raw: "+966 (50) 123-4567",
    normalized: "+966501234567"
  });
});

test("normalizes clearly Egyptian fixed lines without assuming other locals are Egyptian", () => {
  assert.equal(normalizePhoneNumber("03 1234567").normalized, "+2031234567");
  assert.equal(
    normalizePhoneNumber("02 1234 5678").normalized,
    "+20212345678"
  );
  assert.equal(
    normalizePhoneNumber("020 7946 0958").normalized,
    "02079460958"
  );
});

test("deduplicates phone variants by normalized value", () => {
  assert.deepEqual(
    normalizePhoneNumbers([
      "010 1234 5678",
      "+201012345678",
      "00201012345678",
      "+966 50 123 4567"
    ]),
    [
      {
        raw: "010 1234 5678",
        normalized: "+201012345678"
      },
      {
        raw: "+966 50 123 4567",
        normalized: "+966501234567"
      }
    ]
  );
});

test("preserves phone context and source through normalization", () => {
  assert.deepEqual(
    normalizePhoneNumber({
      raw: "٠١٠ ١٢٣٤ ٥٦٧٨",
      context: "للتواصل والحجز عبر واتساب",
      source: "visible-text"
    }),
    {
      raw: "٠١٠ ١٢٣٤ ٥٦٧٨",
      normalized: "+201012345678",
      context: "للتواصل والحجز عبر واتساب",
      source: "visible-text"
    }
  );
});

test("keeps the strongest source when normalized phone variants collide", () => {
  assert.deepEqual(
    normalizePhoneNumbers([
      {
        raw: "01012345678",
        context: "Contact us",
        source: "visible-text"
      },
      {
        raw: "+201012345678",
        context: "Call admissions",
        source: "tel-link"
      }
    ]),
    [
      {
        raw: "+201012345678",
        normalized: "+201012345678",
        context: "Call admissions",
        source: "tel-link"
      }
    ]
  );
});

test("normalizes and deduplicates email addresses", () => {
  assert.equal(normalizeEmail(" Hello@Example.COM "), "Hello@example.com");
  assert.deepEqual(
    normalizeEmails([
      "Hello@Example.COM",
      "hello@example.com",
      "sales@academy.org"
    ]),
    ["Hello@example.com", "sales@academy.org"]
  );
});

test("normalizes URLs while preserving useful query parameters", () => {
  assert.equal(
    normalizeUrl(
      "https://Example.COM/course/?utm_source=facebook&id=42&fbclid=abc#details"
    ),
    "https://example.com/course?id=42"
  );

  assert.equal(
    normalizeUrl(
      "/contact/?utm_medium=email&topic=sales#form",
      "https://example.com/catalog/page"
    ),
    "https://example.com/contact?topic=sales"
  );
});

test("removes common tracking parameters case-insensitively", () => {
  assert.equal(
    normalizeUrl(
      "https://example.com/?UTM_CAMPAIGN=launch&gclid=1&msclkid=2&course=js"
    ),
    "https://example.com?course=js"
  );
});

test("deduplicates normalized URLs and rejects non-web protocols", () => {
  assert.deepEqual(
    normalizeUrls(
      [
        "https://example.com/about/",
        "https://example.com/about#team",
        "/about?utm_source=newsletter",
        "mailto:hello@example.com",
        "javascript:void(0)"
      ],
      "https://example.com"
    ),
    ["https://example.com/about"]
  );
});

test("normalizes social platform values and external link metadata", () => {
  assert.equal(normalizeSocialPlatform("x"), "twitter");
  assert.equal(normalizeSocialPlatform("Twitter"), "twitter");
  assert.equal(normalizeSocialPlatform("unsupported-network"), "other");
  assert.deepEqual(
    normalizeExternalLinks(
      [
        {
          url: "/partner/?utm_source=page",
          text: "  Partner   website ",
          type: "unknown"
        },
        "https://example.com/partner#duplicate"
      ],
      "https://example.com/course"
    ),
    [
      {
        url: "https://example.com/partner",
        text: "Partner website",
        type: "website"
      }
    ]
  );
});

test("normalizes a complete extracted preview without mutating its shape", () => {
  assert.deepEqual(
    normalizeExtractedData({
      pageTitle: " Example Academy ",
      sourceUrl: "https://example.com/course/#overview",
      hostname: "example.com",
      capturedAt: "2026-07-30T12:00:00.000Z",
      phones: ["010 1234 5678", "+201012345678"],
      whatsapp: ["00201012345678"],
      emails: ["Hello@Example.COM", "hello@example.com"],
      socialLinks: [
        {
          platform: "instagram",
          url: "https://instagram.com/example/?utm_source=site#bio"
        }
      ],
      externalLinks: [
        "https://instagram.com/example#external-copy",
        "https://partner.test/?fbclid=abc",
        "https://partner.test"
      ]
    }),
    {
      pageTitle: "Example Academy",
      sourceUrl: "https://example.com/course",
      hostname: "example.com",
      capturedAt: "2026-07-30T12:00:00.000Z",
      phones: [
        {
          raw: "010 1234 5678",
          normalized: "+201012345678"
        }
      ],
      whatsapp: [
        {
          raw: "00201012345678",
          normalized: "+201012345678"
        }
      ],
      emails: ["Hello@example.com"],
      socialLinks: [
        {
          platform: "instagram",
          url: "https://instagram.com/example"
        }
      ],
      externalLinks: [
        {
          url: "https://partner.test",
          text: "",
          type: "website"
        }
      ]
    }
  );
});
