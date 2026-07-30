import {
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUrl
} from "./normalizer.js";

export const STORAGE_KEY = "leads";

function cloneList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) =>
    value && typeof value === "object" ? { ...value } : value
  );
}

function createLeadId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createLeadRecord(lead, id = createLeadId()) {
  const capturedAt =
    String(lead?.capturedAt ?? "").trim() || new Date().toISOString();
  const socialLinks = cloneList(lead?.socialLinks);
  const record = {
    id,
    pageTitle: String(lead?.pageTitle ?? "").trim(),
    sourceUrl: String(lead?.sourceUrl ?? "").trim(),
    hostname: String(lead?.hostname ?? "").trim(),
    capturedAt,
    phones: cloneList(lead?.phones),
    whatsapp: cloneList(lead?.whatsapp),
    emails: cloneList(lead?.emails),
    socialLinks,
    externalLinks: removeSocialUrlsFromExternal(
      socialLinks,
      lead?.externalLinks
    )
  };
  const lastUpdatedAt = String(lead?.lastUpdatedAt ?? "").trim();

  if (lastUpdatedAt) {
    record.lastUpdatedAt = lastUpdatedAt;
  }

  return record;
}

function phoneIdentity(value) {
  const candidate =
    value && typeof value === "object"
      ? value.normalized || value.raw
      : value;

  return normalizePhoneNumber(candidate).normalized;
}

const PHONE_SOURCE_PRIORITY = {
  "tel-link": 6,
  "whatsapp-link": 5,
  "meta-tag": 4,
  "button-text": 3,
  "anchor-text": 2,
  "visible-text": 1
};

function mergePhoneMetadata(existingValue, incomingValue) {
  const existingPhone =
    existingValue && typeof existingValue === "object"
      ? existingValue
      : normalizePhoneNumber(existingValue);
  const incomingPhone =
    incomingValue && typeof incomingValue === "object"
      ? incomingValue
      : normalizePhoneNumber(incomingValue);
  const existingPriority =
    PHONE_SOURCE_PRIORITY[existingPhone?.source] ?? 0;
  const incomingPriority =
    PHONE_SOURCE_PRIORITY[incomingPhone?.source] ?? 0;
  const preferred =
    incomingPriority > existingPriority ? incomingPhone : existingPhone;
  const fallback =
    preferred === existingPhone ? incomingPhone : existingPhone;

  return {
    ...preferred,
    ...(preferred.context || !fallback.context
      ? {}
      : { context: fallback.context }),
    ...(preferred.source || !fallback.source
      ? {}
      : { source: fallback.source })
  };
}

function mergePhoneLists(existingValues, incomingValues) {
  const uniqueValues = new Map();

  for (const value of [
    ...cloneList(existingValues),
    ...cloneList(incomingValues)
  ]) {
    const identity = phoneIdentity(value);

    if (!identity) {
      continue;
    }

    const existingValue = uniqueValues.get(identity);
    uniqueValues.set(
      identity,
      existingValue
        ? mergePhoneMetadata(existingValue, value)
        : value
    );
  }

  return Array.from(uniqueValues.values());
}

function socialLinkIdentity(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const platform = String(value.platform ?? "").trim().toLowerCase();
  const rawUrl = String(value.url ?? "").trim();
  const url = /^whatsapp:/i.test(rawUrl)
    ? rawUrl
    : normalizeUrl(rawUrl);

  return platform && url ? `${platform}:${url}` : "";
}

function socialUrlIdentity(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const rawUrl = String(value.url ?? "").trim();
  return /^whatsapp:/i.test(rawUrl) ? rawUrl : normalizeUrl(rawUrl);
}

function externalLinkIdentity(value) {
  return normalizeUrl(value) || String(value ?? "").trim();
}

function emailIdentity(value) {
  return normalizeEmail(value).toLowerCase();
}

function removeSocialUrlsFromExternal(socialLinks, externalLinks) {
  const socialUrls = new Set(
    cloneList(socialLinks).map(socialUrlIdentity).filter(Boolean)
  );

  return cloneList(externalLinks).filter(
    (url) => !socialUrls.has(externalLinkIdentity(url))
  );
}

function mergeUnique(existingValues, incomingValues, getIdentity) {
  const uniqueValues = new Map();

  for (const value of [
    ...cloneList(existingValues),
    ...cloneList(incomingValues)
  ]) {
    const identity = getIdentity(value);

    if (identity && !uniqueValues.has(identity)) {
      uniqueValues.set(identity, value);
    }
  }

  return Array.from(uniqueValues.values());
}

function getOldestCapturedAt(existingValue, incomingValue) {
  const existing = String(existingValue ?? "").trim();
  const incoming = String(incomingValue ?? "").trim();
  const existingTime = Date.parse(existing);
  const incomingTime = Date.parse(incoming);

  if (Number.isFinite(existingTime) && Number.isFinite(incomingTime)) {
    return existingTime <= incomingTime ? existing : incoming;
  }

  return existing || incoming || new Date().toISOString();
}

export function mergeLeadRecords(
  existingLead,
  incomingLead,
  { lastUpdatedAt = new Date().toISOString() } = {}
) {
  const socialLinks = mergeUnique(
    existingLead?.socialLinks,
    incomingLead?.socialLinks,
    socialLinkIdentity
  );
  const externalLinks = removeSocialUrlsFromExternal(
    socialLinks,
    mergeUnique(
      existingLead?.externalLinks,
      incomingLead?.externalLinks,
      externalLinkIdentity
    )
  );

  return {
    id: existingLead.id,
    pageTitle:
      String(incomingLead?.pageTitle ?? "").trim() ||
      String(existingLead?.pageTitle ?? "").trim(),
    sourceUrl:
      String(existingLead?.sourceUrl ?? "").trim() ||
      String(incomingLead?.sourceUrl ?? "").trim(),
    hostname:
      String(incomingLead?.hostname ?? "").trim() ||
      String(existingLead?.hostname ?? "").trim(),
    capturedAt: getOldestCapturedAt(
      existingLead?.capturedAt,
      incomingLead?.capturedAt
    ),
    lastUpdatedAt,
    phones: mergePhoneLists(
      existingLead?.phones,
      incomingLead?.phones
    ),
    whatsapp: mergePhoneLists(
      existingLead?.whatsapp,
      incomingLead?.whatsapp
    ),
    emails: mergeUnique(
      existingLead?.emails,
      incomingLead?.emails,
      emailIdentity
    ),
    socialLinks,
    externalLinks
  };
}

async function writeLeads(leads) {
  await chrome.storage.local.set({ [STORAGE_KEY]: leads });
}

export async function getAllLeads() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const leads = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];

  return leads.map((lead) => ({
    ...lead,
    emails: cloneList(lead?.emails),
    externalLinks: removeSocialUrlsFromExternal(
      lead?.socialLinks,
      lead?.externalLinks
    )
  }));
}

export async function getLeadCount() {
  return (await getAllLeads()).length;
}

export async function getLeadBySourceUrl(sourceUrl) {
  const targetUrl = String(sourceUrl ?? "").trim();

  if (!targetUrl) {
    return null;
  }

  return (
    (await getAllLeads()).find((lead) => lead.sourceUrl === targetUrl) ?? null
  );
}

export async function wasSourceCaptured(sourceUrl) {
  return Boolean(await getLeadBySourceUrl(sourceUrl));
}

export const hasCapturedSourceUrl = wasSourceCaptured;
export const isSourceCaptured = wasSourceCaptured;

export async function addLead(
  lead,
  { onDuplicate = "reject" } = {}
) {
  const leads = await getAllLeads();
  const sourceUrl = String(lead?.sourceUrl ?? "").trim();
  const duplicateIndex = sourceUrl
    ? leads.findIndex((storedLead) => storedLead.sourceUrl === sourceUrl)
    : -1;

  if (duplicateIndex !== -1) {
    const existingLead = leads[duplicateIndex];

    if (onDuplicate === "replace") {
      const replacement = createLeadRecord(lead, existingLead.id);
      leads[duplicateIndex] = replacement;
      await writeLeads(leads);
      return { status: "replaced", lead: replacement };
    }

    if (onDuplicate === "merge") {
      const mergedLead = mergeLeadRecords(existingLead, lead);
      leads[duplicateIndex] = mergedLead;
      await writeLeads(leads);
      return { status: "merged", lead: mergedLead };
    }

    return { status: "duplicate", lead: existingLead };
  }

  const usedIds = new Set(leads.map((storedLead) => storedLead.id));
  let id = String(lead?.id ?? "").trim() || createLeadId();

  while (usedIds.has(id)) {
    id = createLeadId();
  }

  const newLead = createLeadRecord(lead, id);
  leads.push(newLead);
  await writeLeads(leads);

  return { status: "added", lead: newLead };
}

export async function deleteLead(id) {
  const targetId = String(id ?? "").trim();
  const leads = await getAllLeads();
  const remainingLeads = leads.filter((lead) => lead.id !== targetId);

  if (remainingLeads.length === leads.length) {
    return false;
  }

  await writeLeads(remainingLeads);
  return true;
}

export async function clearAllLeads() {
  await writeLeads([]);
}
