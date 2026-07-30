import { normalizePhoneNumber, normalizeUrl } from "./normalizer.js";

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
  const record = {
    id,
    pageTitle: String(lead?.pageTitle ?? "").trim(),
    sourceUrl: String(lead?.sourceUrl ?? "").trim(),
    hostname: String(lead?.hostname ?? "").trim(),
    capturedAt,
    phones: cloneList(lead?.phones),
    whatsapp: cloneList(lead?.whatsapp),
    socialLinks: cloneList(lead?.socialLinks),
    externalLinks: cloneList(lead?.externalLinks)
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

function externalLinkIdentity(value) {
  return normalizeUrl(value) || String(value ?? "").trim();
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
    phones: mergeUnique(
      existingLead?.phones,
      incomingLead?.phones,
      phoneIdentity
    ),
    whatsapp: mergeUnique(
      existingLead?.whatsapp,
      incomingLead?.whatsapp,
      phoneIdentity
    ),
    socialLinks: mergeUnique(
      existingLead?.socialLinks,
      incomingLead?.socialLinks,
      socialLinkIdentity
    ),
    externalLinks: mergeUnique(
      existingLead?.externalLinks,
      incomingLead?.externalLinks,
      externalLinkIdentity
    )
  };
}

async function writeLeads(leads) {
  await chrome.storage.local.set({ [STORAGE_KEY]: leads });
}

export async function getAllLeads() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
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
