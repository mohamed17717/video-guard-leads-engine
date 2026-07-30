import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePhoneNumber,
  normalizePhoneNumbers,
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
