import assert from "node:assert/strict";
import test from "node:test";

import {
  addLead,
  clearAllLeads,
  deleteLead,
  getAllLeads,
  getLeadCount,
  getLeadBySourceUrl,
  mergeLeadRecords,
  wasSourceCaptured
} from "../services/storage.js";

function installStorage(initialLeads = []) {
  const data = { leads: structuredClone(initialLeads) };

  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: structuredClone(data[key]) };
        },
        async set(values) {
          Object.assign(data, structuredClone(values));
        }
      }
    }
  };

  return data;
}

function lead(overrides = {}) {
  return {
    pageTitle: "Example Academy",
    sourceUrl: "https://example.com/course",
    hostname: "example.com",
    capturedAt: "2026-07-30T10:00:00.000Z",
    phones: [],
    whatsapp: [],
    emails: [],
    socialLinks: [],
    externalLinks: [],
    ...overrides
  };
}

test("adds and retrieves a persistent lead record", async () => {
  installStorage();

  const result = await addLead(lead());

  assert.equal(result.status, "added");
  assert.ok(result.lead.id);
  assert.equal(await getLeadCount(), 1);
  assert.equal(await wasSourceCaptured("https://example.com/course"), true);
  assert.equal(
    (await getLeadBySourceUrl("https://example.com/course")).id,
    result.lead.id
  );
});

test("returns a duplicate result without writing a second lead", async () => {
  installStorage();
  const firstResult = await addLead(lead());
  const duplicateResult = await addLead(
    lead({ pageTitle: "Updated Academy" })
  );

  assert.equal(duplicateResult.status, "duplicate");
  assert.equal(duplicateResult.lead.id, firstResult.lead.id);
  assert.equal(await getLeadCount(), 1);
  assert.equal((await getAllLeads())[0].pageTitle, "Example Academy");
});

test("suppresses stored social URLs from external links", async () => {
  installStorage([
    lead({
      id: "legacy-lead",
      socialLinks: [
        {
          platform: "instagram",
          url: "https://instagram.com/example"
        }
      ],
      externalLinks: [
        "https://instagram.com/example/",
        "https://partner.test"
      ]
    })
  ]);

  assert.deepEqual((await getAllLeads())[0].externalLinks, [
    "https://partner.test"
  ]);
});

test("replaces a duplicate while preserving its stable ID", async () => {
  installStorage();
  const firstResult = await addLead(lead());
  const replacementResult = await addLead(
    lead({
      pageTitle: "Replacement Academy",
      capturedAt: "2026-07-30T11:00:00.000Z"
    }),
    { onDuplicate: "replace" }
  );

  assert.equal(replacementResult.status, "replaced");
  assert.equal(replacementResult.lead.id, firstResult.lead.id);
  assert.equal(replacementResult.lead.pageTitle, "Replacement Academy");
  assert.equal(await getLeadCount(), 1);
});

test("merges duplicate values and keeps the oldest capture time", () => {
  const merged = mergeLeadRecords(
    lead({
      id: "lead-1",
      capturedAt: "2026-07-30T10:00:00.000Z",
      phones: [
        {
          raw: "010 1234 5678",
          normalized: "+201012345678"
        }
      ],
      emails: ["hello@example.com"],
      socialLinks: [
        {
          platform: "instagram",
          url: "https://instagram.com/example"
        }
      ],
      externalLinks: [
        "https://instagram.com/example/",
        "https://partner.test"
      ]
    }),
    lead({
      pageTitle: "Updated Academy",
      capturedAt: "2026-07-29T10:00:00.000Z",
      phones: [
        {
          raw: "+201012345678",
          normalized: "+201012345678"
        },
        {
          raw: "+966501234567",
          normalized: "+966501234567"
        }
      ],
      emails: ["HELLO@example.com", "sales@example.com"],
      socialLinks: [
        {
          platform: "instagram",
          url: "https://instagram.com/example/"
        },
        {
          platform: "linkedin",
          url: "https://linkedin.com/company/example"
        }
      ],
      externalLinks: [
        "https://linkedin.com/company/example",
        "https://partner.test/",
        "https://another-partner.test/"
      ]
    }),
    { lastUpdatedAt: "2026-07-30T12:00:00.000Z" }
  );

  assert.equal(merged.id, "lead-1");
  assert.equal(merged.pageTitle, "Updated Academy");
  assert.equal(merged.capturedAt, "2026-07-29T10:00:00.000Z");
  assert.equal(merged.lastUpdatedAt, "2026-07-30T12:00:00.000Z");
  assert.equal(merged.phones.length, 2);
  assert.deepEqual(merged.emails, [
    "hello@example.com",
    "sales@example.com"
  ]);
  assert.equal(merged.socialLinks.length, 2);
  assert.deepEqual(merged.externalLinks, [
    "https://partner.test",
    "https://another-partner.test/"
  ]);
});

test("merges a duplicate in storage without increasing the count", async () => {
  installStorage();
  const firstResult = await addLead(
    lead({ externalLinks: ["https://one.test"] })
  );
  const mergedResult = await addLead(
    lead({ externalLinks: ["https://two.test"] }),
    { onDuplicate: "merge" }
  );

  assert.equal(mergedResult.status, "merged");
  assert.equal(mergedResult.lead.id, firstResult.lead.id);
  assert.equal(mergedResult.lead.externalLinks.length, 2);
  assert.ok(mergedResult.lead.lastUpdatedAt);
  assert.equal(await getLeadCount(), 1);
});

test("deletes one lead and clears all leads", async () => {
  installStorage();
  const first = await addLead(lead());
  await addLead(
    lead({
      sourceUrl: "https://second.test",
      hostname: "second.test"
    })
  );

  assert.equal(await deleteLead(first.lead.id), true);
  assert.equal(await deleteLead("missing-id"), false);
  assert.equal(await getLeadCount(), 1);

  await clearAllLeads();
  assert.equal(await getLeadCount(), 0);
});
