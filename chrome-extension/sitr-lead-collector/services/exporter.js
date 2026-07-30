function formatPhone(phone) {
  if (phone && typeof phone === "object") {
    const raw = String(phone.raw ?? "").trim();
    const normalized = String(phone.normalized ?? "").trim();

    if (raw && normalized && raw !== normalized) {
      return `${raw} (${normalized})`;
    }

    return normalized || raw;
  }

  return String(phone ?? "").trim();
}

function formatSocialLink(link) {
  if (link && typeof link === "object") {
    const platform = String(link.platform ?? "").trim();
    const url = String(link.url ?? "").trim();
    return platform ? `${platform}: ${url}` : url;
  }

  return String(link ?? "").trim();
}

function formatSection(label, values, formatter = String) {
  const formattedValues = (Array.isArray(values) ? values : [])
    .map(formatter)
    .filter(Boolean);
  const lines = formattedValues.length
    ? formattedValues.map((value) => `- ${value}`)
    : ["- None"];

  return [label, ...lines].join("\n");
}

export function formatLeadAsText(lead) {
  return [
    `Page Title: ${String(lead?.pageTitle ?? "").trim() || "Untitled page"}`,
    `Source URL: ${String(lead?.sourceUrl ?? "").trim() || "None"}`,
    `Captured At: ${String(lead?.capturedAt ?? "").trim() || "Unknown"}`,
    "",
    formatSection("Phones", lead?.phones, formatPhone),
    "",
    formatSection("WhatsApp", lead?.whatsapp, formatPhone),
    "",
    formatSection("Social Links", lead?.socialLinks, formatSocialLink),
    "",
    formatSection("External Links", lead?.externalLinks)
  ].join("\n");
}

const EXPORT_SEPARATOR = "=".repeat(50);

const PLATFORM_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  snapchat: "Snapchat",
  telegram: "Telegram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X",
  youtube: "YouTube"
};

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatIsoToSeconds(value) {
  return toValidDate(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatExportPhone(phone) {
  if (phone && typeof phone === "object") {
    return String(phone.normalized || phone.raw || "").trim();
  }

  return String(phone ?? "").trim();
}

function formatExportSocialLink(link) {
  if (link && typeof link === "object") {
    const platform = String(link.platform ?? "").trim().toLowerCase();
    const label =
      PLATFORM_LABELS[platform] ||
      `${platform.charAt(0).toUpperCase()}${platform.slice(1)}` ||
      "Social";
    const url = String(link.url ?? "").trim();
    return url ? `${label}: ${url}` : "";
  }

  return String(link ?? "").trim();
}

function formatExportList(label, values, formatter = String) {
  const items = (Array.isArray(values) ? values : [])
    .map(formatter)
    .filter(Boolean);
  const lines = items.length ? items.map((item) => `- ${item}`) : ["- None"];

  return [`${label}:`, ...lines].join("\n");
}

function formatExportLead(lead, index) {
  return [
    EXPORT_SEPARATOR,
    `LEAD ${index}`,
    EXPORT_SEPARATOR,
    "",
    "Page Title:",
    String(lead?.pageTitle ?? "").trim() || "Untitled page",
    "",
    "Source URL:",
    String(lead?.sourceUrl ?? "").trim() || "None",
    "",
    "Hostname:",
    String(lead?.hostname ?? "").trim() || "None",
    "",
    "Captured At:",
    formatIsoToSeconds(lead?.capturedAt),
    "",
    formatExportList("Phone Numbers", lead?.phones, formatExportPhone),
    "",
    formatExportList("WhatsApp", lead?.whatsapp, formatExportPhone),
    "",
    formatExportList(
      "Social Links",
      lead?.socialLinks,
      formatExportSocialLink
    ),
    "",
    formatExportList("External Links", lead?.externalLinks),
    "",
    EXPORT_SEPARATOR,
    "END LEAD",
    EXPORT_SEPARATOR
  ].join("\n");
}

export function formatLeadCollectionAsText(
  leads,
  { exportedAt = new Date() } = {}
) {
  const leadList = Array.isArray(leads) ? leads : [];
  const header = [
    "SITR LEAD COLLECTION",
    `Exported At: ${formatIsoToSeconds(exportedAt)}`,
    `Total Leads: ${leadList.length}`
  ].join("\n");
  const leadBlocks = leadList.map((lead, index) =>
    formatExportLead(lead, index + 1)
  );

  return [header, ...leadBlocks].join("\n\n") + "\n";
}

function createExportFilename(extension, value = new Date()) {
  const date = toValidDate(value);
  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
  const timePart = [
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0")
  ].join("");

  return `sitr-leads-${datePart}-${timePart}.${extension}`;
}

export function createTxtFilename(value = new Date()) {
  return createExportFilename("txt", value);
}

export function createJsonFilename(value = new Date()) {
  return createExportFilename("json", value);
}

export function formatLeadCollectionAsJson(
  leads,
  { exportedAt = new Date() } = {}
) {
  const leadList = Array.isArray(leads) ? leads : [];

  return (
    JSON.stringify(
      {
        exportedAt: formatIsoToSeconds(exportedAt),
        totalLeads: leadList.length,
        leads: leadList
      },
      null,
      2
    ) + "\n"
  );
}

async function downloadUtf8File(
  content,
  { filename, mimeType, includeBom = false }
) {
  const blob = new Blob(includeBom ? ["\uFEFF", content] : [content], {
    type: `${mimeType};charset=utf-8`
  });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const downloadId = await chrome.downloads.download({
      url: objectUrl,
      filename,
      conflictAction: "uniquify",
      saveAs: false
    });

    if (typeof downloadId !== "number") {
      throw new Error(`Chrome did not start the ${filename} download.`);
    }

    return { downloadId, filename };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function downloadLeadCollectionAsTxt(
  leads,
  { exportedAt = new Date() } = {}
) {
  const exportDate = toValidDate(exportedAt);
  const text = formatLeadCollectionAsText(leads, { exportedAt: exportDate });
  const filename = createTxtFilename(exportDate);

  return downloadUtf8File(text, {
    filename,
    mimeType: "text/plain",
    includeBom: true
  });
}

export async function downloadLeadCollectionAsJson(
  leads,
  { exportedAt = new Date() } = {}
) {
  const exportDate = toValidDate(exportedAt);
  const json = formatLeadCollectionAsJson(leads, {
    exportedAt: exportDate
  });
  const filename = createJsonFilename(exportDate);

  return downloadUtf8File(json, {
    filename,
    mimeType: "application/json"
  });
}
