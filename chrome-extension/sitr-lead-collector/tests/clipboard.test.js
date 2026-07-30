import assert from "node:assert/strict";
import test from "node:test";

import {
  copyTextToClipboard,
  formatExternalLinksForCopy,
  formatLeadsForCopy,
  formatPhoneNumbersForCopy,
  formatSocialLinksForCopy
} from "../services/clipboard.js";
import { formatLeadCollectionAsText } from "../services/exporter.js";

test("formats phone and link fields as unique newline-separated values", () => {
  assert.equal(
    formatPhoneNumbersForCopy([
      {
        raw: "010 1234 5678",
        normalized: "+201012345678"
      },
      "+201012345678",
      {
        raw: "+966 50 123 4567",
        normalized: "+966501234567"
      }
    ]),
    "+201012345678\n+966501234567"
  );
  assert.equal(
    formatSocialLinksForCopy([
      {
        platform: "instagram",
        url: "https://instagram.com/example"
      },
      {
        platform: "facebook",
        url: "https://facebook.com/example"
      }
    ]),
    "https://instagram.com/example\nhttps://facebook.com/example"
  );
  assert.equal(
    formatExternalLinksForCopy([
      {
        url: "https://partner.test",
        text: "Partner",
        type: "website"
      },
      "https://docs.partner.test"
    ]),
    "https://partner.test\nhttps://docs.partner.test"
  );
});

test("uses the exact TXT collection format for complete lead copies", () => {
  const leads = [
    {
      pageTitle: "أكاديمية أحمد",
      sourceUrl: "https://example.com",
      hostname: "example.com",
      capturedAt: "2026-07-30T03:20:00Z",
      phones: [{ normalized: "+201012345678" }],
      whatsapp: [],
      emails: [],
      socialLinks: [],
      externalLinks: []
    }
  ];
  const options = { exportedAt: "2026-07-30T04:00:00Z" };

  assert.equal(
    formatLeadsForCopy(leads, options),
    formatLeadCollectionAsText(leads, options)
  );
});

test("writes copy text through the Clipboard API", async () => {
  let copiedText = "";

  await copyTextToClipboard("Copied value", {
    clipboard: {
      async writeText(value) {
        copiedText = value;
      }
    }
  });

  assert.equal(copiedText, "Copied value");
});
