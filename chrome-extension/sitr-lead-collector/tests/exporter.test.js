import assert from "node:assert/strict";
import test from "node:test";

import { formatLeadAsText } from "../services/exporter.js";

test("formats a lead as readable plain text", () => {
  const text = formatLeadAsText({
    pageTitle: "Example Academy",
    sourceUrl: "https://example.com",
    capturedAt: "2026-07-30T10:00:00.000Z",
    phones: [
      {
        raw: "010 1234 5678",
        normalized: "+201012345678"
      }
    ],
    whatsapp: [
      {
        raw: "+201112345678",
        normalized: "+201112345678"
      }
    ],
    socialLinks: [
      {
        platform: "instagram",
        url: "https://instagram.com/example"
      }
    ],
    externalLinks: ["https://partner.test"]
  });

  assert.equal(
    text,
    [
      "Page Title: Example Academy",
      "Source URL: https://example.com",
      "Captured At: 2026-07-30T10:00:00.000Z",
      "",
      "Phones",
      "- 010 1234 5678 (+201012345678)",
      "",
      "WhatsApp",
      "- +201112345678",
      "",
      "Social Links",
      "- instagram: https://instagram.com/example",
      "",
      "External Links",
      "- https://partner.test"
    ].join("\n")
  );
});

test("formats missing lead values without throwing", () => {
  const text = formatLeadAsText({});

  assert.match(text, /Page Title: Untitled page/);
  assert.match(text, /Source URL: None/);
  assert.match(text, /Phones\n- None/);
});
