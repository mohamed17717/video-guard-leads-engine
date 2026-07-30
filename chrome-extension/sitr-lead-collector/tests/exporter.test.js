import assert from "node:assert/strict";
import test from "node:test";

import {
  CSV_HEADERS,
  createCsvFilename,
  createJsonFilename,
  createTxtFilename,
  downloadLeadCollectionAsCsv,
  downloadLeadCollectionAsJson,
  downloadLeadCollectionAsTxt,
  formatLeadAsText,
  formatLeadCollectionAsCsv,
  formatLeadCollectionAsJson,
  formatLeadCollectionAsText,
  mapLeadToCsvRow
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

test("uses the exact requested CSV headers", () => {
  assert.equal(
    CSV_HEADERS.join(","),
    "name,company_name,phone,whatsapp,email,website,social_url,country,source,notes"
  );
});

test("maps lead data to the CSV schema and moves extra data into notes", () => {
  const row = mapLeadToCsvRow({
    pageTitle: 'أكاديمية, "أحمد"',
    sourceUrl: "https://www.example.com/course",
    hostname: "www.example.com",
    capturedAt: "2026-07-30T03:20:00Z",
    lastUpdatedAt: "2026-07-30T04:10:00Z",
    phones: [
      {
        raw: "010 1234 5678",
        normalized: "+201012345678",
        context: "Call admissions",
        source: "tel-link"
      },
      { raw: "011 2345 6789", normalized: "+201123456789" }
    ],
    whatsapp: [
      { raw: "012 3456 7890", normalized: "+201234567890" },
      { raw: "015 4567 8901", normalized: "+201545678901" }
    ],
    emails: ["hello@example.com", "sales@example.com"],
    socialLinks: [
      {
        platform: "youtube",
        url: "https://youtube.com/@example"
      },
      {
        platform: "instagram",
        url: "https://instagram.com/example"
      },
      {
        platform: "facebook",
        url: "https://facebook.com/example"
      }
    ],
    externalLinks: [
      {
        url: "https://partner.example",
        text: "Partner website",
        type: "website"
      }
    ]
  });

  assert.equal(row.name, "example.com");
  assert.equal(row.company_name, "example.com");
  assert.equal(row.phone, "+201012345678");
  assert.equal(row.whatsapp, "+201234567890");
  assert.equal(row.email, "hello@example.com");
  assert.equal(row.website, "https://www.example.com/course");
  assert.equal(row.social_url, "https://instagram.com/example");
  assert.equal(row.country, "EG");
  assert.equal(row.source, "chrome extension");
  assert.match(row.notes, /page title: أكاديمية, "أحمد"/);
  assert.match(row.notes, /other phones: \+201123456789/);
  assert.match(
    row.notes,
    /phone details: \+201012345678 \(source=tel-link, context=Call admissions\)/
  );
  assert.match(row.notes, /other WhatsApp: \+201545678901/);
  assert.match(row.notes, /other emails: sales@example.com/);
  assert.match(row.notes, /YouTube: https:\/\/youtube.com\/@example/);
  assert.match(row.notes, /Facebook: https:\/\/facebook.com\/example/);
  assert.match(
    row.notes,
    /external links: Partner website: https:\/\/partner.example/
  );
});

test("uses a WhatsApp social link as WhatsApp without duplicating it in notes", () => {
  const row = mapLeadToCsvRow({
    sourceUrl: "https://example.com",
    socialLinks: [
      {
        platform: "whatsapp",
        url: "https://wa.me/966501234567"
      },
      {
        platform: "facebook",
        url: "https://facebook.com/example"
      }
    ]
  });

  assert.equal(row.whatsapp, "https://wa.me/966501234567");
  assert.equal(row.social_url, "https://facebook.com/example");
  assert.equal(row.country, "SA");
  assert.doesNotMatch(row.notes, /wa\.me/);
});

test("leaves CSV country empty when phone prefixes disagree or are uncertain", () => {
  const conflicting = mapLeadToCsvRow({
    phones: [{ normalized: "+201012345678" }],
    whatsapp: [{ normalized: "+966501234567" }]
  });
  const uncertain = mapLeadToCsvRow({
    phones: [{ normalized: "+14155550123" }]
  });

  assert.equal(conflicting.country, "");
  assert.equal(uncertain.country, "");
});

test("formats UTF-8 CSV and correctly escapes commas and quotes", () => {
  const csv = formatLeadCollectionAsCsv([
    {
      pageTitle: 'أكاديمية, "أحمد"',
      sourceUrl: "https://example.com",
      hostname: "example.com"
    }
  ]);

  assert.equal(csv.split("\r\n")[0], CSV_HEADERS.join(","));
  assert.match(csv, /أكاديمية/);
  assert.match(csv, /"page title: أكاديمية, ""أحمد"""/);
  assert.ok(csv.endsWith("\r\n"));
});

test("creates the requested UTC CSV filename", () => {
  assert.equal(
    createCsvFilename("2026-07-30T04:00:00.000Z"),
    "sitr-leads-2026-07-30-0400.csv"
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

test("starts a Chrome download with a UTF-8 BOM CSV blob", async () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let exportedBlob = null;
  let downloadOptions = null;

  URL.createObjectURL = (blob) => {
    exportedBlob = blob;
    return "blob:csv-export";
  };
  URL.revokeObjectURL = () => {};
  globalThis.chrome = {
    downloads: {
      async download(options) {
        downloadOptions = options;
        return 126;
      }
    }
  };

  try {
    const result = await downloadLeadCollectionAsCsv(
      [{ pageTitle: "أكاديمية أحمد", hostname: "example.com" }],
      { exportedAt: "2026-07-30T04:00:00.000Z" }
    );
    const content = await exportedBlob.text();
    const bytes = new Uint8Array(await exportedBlob.arrayBuffer());

    assert.deepEqual(result, {
      downloadId: 126,
      filename: "sitr-leads-2026-07-30-0400.csv"
    });
    assert.equal(downloadOptions.filename, result.filename);
    assert.equal(exportedBlob.type, "text/csv;charset=utf-8");
    assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
    assert.match(content, /أكاديمية أحمد/);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
