import assert from "node:assert/strict";
import test from "node:test";

import {
  createJsonFilename,
  createTxtFilename,
  downloadLeadCollectionAsJson,
  downloadLeadCollectionAsTxt,
  formatLeadAsText,
  formatLeadCollectionAsJson,
  formatLeadCollectionAsText
} from "../services/exporter.js";

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
    emails: ["hello@example.com"],
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
      "Emails",
      "- hello@example.com",
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

test("formats the complete TXT collection with separators and Arabic text", () => {
  const text = formatLeadCollectionAsText(
    [
      {
        pageTitle: "أكاديمية أحمد",
        sourceUrl: "https://facebook.com/ahmedacademy",
        hostname: "facebook.com",
        capturedAt: "2026-07-30T03:20:00.000Z",
        phones: [
          {
            raw: "01012345678",
            normalized: "+201012345678"
          }
        ],
        whatsapp: ["https://wa.me/201012345678"],
        emails: ["hello@example.com"],
        socialLinks: [
          {
            platform: "youtube",
            url: "https://youtube.com/@ahmedacademy"
          }
        ],
        externalLinks: ["https://ahmedacademy.com"]
      }
    ],
    { exportedAt: "2026-07-30T04:00:00.000Z" }
  );

  assert.match(text, /^SITR LEAD COLLECTION/);
  assert.match(text, /Exported At: 2026-07-30T04:00:00Z/);
  assert.match(text, /Total Leads: 1/);
  assert.match(text, /LEAD 1/);
  assert.match(text, /Page Title:\nأكاديمية أحمد/);
  assert.match(text, /Phone Numbers:\n- \+201012345678/);
  assert.match(text, /Emails:\n- hello@example.com/);
  assert.match(
    text,
    /Social Links:\n- YouTube: https:\/\/youtube.com\/@ahmedacademy/
  );
  assert.match(text, /END LEAD/);
});

test("creates the requested UTC TXT filename", () => {
  assert.equal(
    createTxtFilename("2026-07-30T04:00:00.000Z"),
    "sitr-leads-2026-07-30-0400.txt"
  );
});

test("pretty-prints JSON while preserving raw values and Arabic content", () => {
  const rawPhone = {
    raw: "010 1234 5678",
    normalized: "+201012345678"
  };
  const json = formatLeadCollectionAsJson(
    [
      {
        id: "lead-1",
        pageTitle: "أكاديمية أحمد",
        sourceUrl: "https://example.com",
        hostname: "example.com",
        capturedAt: "2026-07-30T03:20:00Z",
        phones: [rawPhone],
        whatsapp: [],
        emails: ["hello@example.com"],
        socialLinks: [],
        externalLinks: []
      }
    ],
    { exportedAt: "2026-07-30T04:00:00.000Z" }
  );
  const parsed = JSON.parse(json);

  assert.match(json, /\n  "exportedAt":/);
  assert.match(json, /أكاديمية أحمد/);
  assert.equal(parsed.exportedAt, "2026-07-30T04:00:00Z");
  assert.equal(parsed.totalLeads, 1);
  assert.deepEqual(parsed.leads[0].phones[0], rawPhone);
  assert.deepEqual(parsed.leads[0].emails, ["hello@example.com"]);
});

test("creates the requested UTC JSON filename", () => {
  assert.equal(
    createJsonFilename("2026-07-30T04:00:00.000Z"),
    "sitr-leads-2026-07-30-0400.json"
  );
});

test("starts a Chrome download with a UTF-8 text blob", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let exportedBlob = null;
  let downloadOptions = null;
  let revokedUrl = null;

  URL.createObjectURL = (blob) => {
    exportedBlob = blob;
    return "blob:test-export";
  };
  URL.revokeObjectURL = (url) => {
    revokedUrl = url;
  };
  globalThis.chrome = {
    downloads: {
      async download(options) {
        downloadOptions = options;
        return 42;
      }
    }
  };

  try {
    const result = await downloadLeadCollectionAsTxt([], {
      exportedAt: "2026-07-30T04:00:00.000Z"
    });

    assert.deepEqual(result, {
      downloadId: 42,
      filename: "sitr-leads-2026-07-30-0400.txt"
    });
    assert.equal(downloadOptions.url, "blob:test-export");
    assert.equal(downloadOptions.filename, result.filename);
    assert.equal(exportedBlob.type, "text/plain;charset=utf-8");
    assert.match(await exportedBlob.text(), /SITR LEAD COLLECTION/);
    assert.equal(revokedUrl, "blob:test-export");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test("starts a Chrome download with a UTF-8 JSON blob", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let exportedBlob = null;
  let downloadOptions = null;

  URL.createObjectURL = (blob) => {
    exportedBlob = blob;
    return "blob:json-export";
  };
  URL.revokeObjectURL = () => {};
  globalThis.chrome = {
    downloads: {
      async download(options) {
        downloadOptions = options;
        return 84;
      }
    }
  };

  try {
    const result = await downloadLeadCollectionAsJson(
      [{ pageTitle: "أكاديمية أحمد" }],
      { exportedAt: "2026-07-30T04:00:00.000Z" }
    );

    assert.deepEqual(result, {
      downloadId: 84,
      filename: "sitr-leads-2026-07-30-0400.json"
    });
    assert.equal(downloadOptions.filename, result.filename);
    assert.equal(exportedBlob.type, "application/json;charset=utf-8");
    assert.equal(
      JSON.parse(await exportedBlob.text()).leads[0].pageTitle,
      "أكاديمية أحمد"
    );
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
