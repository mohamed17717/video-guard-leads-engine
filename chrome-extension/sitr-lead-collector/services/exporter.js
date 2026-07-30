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
    formatSection("Emails", lead?.emails),
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

export const CSV_HEADERS = [
  "name",
  "company_name",
  "phone",
  "whatsapp",
  "email",
  "website",
  "social_url",
  "country",
  "source",
  "notes"
];

const COUNTRY_CALLING_CODES = [
  ["+971", "AE"],
  ["+966", "SA"],
  ["+965", "KW"],
  ["+974", "QA"],
  ["+973", "BH"],
  ["+968", "OM"],
  ["+967", "YE"],
  ["+964", "IQ"],
  ["+963", "SY"],
  ["+962", "JO"],
  ["+961", "LB"],
  ["+970", "PS"],
  ["+972", "IL"],
  ["+212", "MA"],
  ["+213", "DZ"],
  ["+216", "TN"],
  ["+218", "LY"],
  ["+249", "SD"],
  ["+252", "SO"],
  ["+253", "DJ"],
  ["+234", "NG"],
  ["+254", "KE"],
  ["+351", "PT"],
  ["+352", "LU"],
  ["+353", "IE"],
  ["+354", "IS"],
  ["+355", "AL"],
  ["+356", "MT"],
  ["+357", "CY"],
  ["+358", "FI"],
  ["+359", "BG"],
  ["+420", "CZ"],
  ["+421", "SK"],
  ["+20", "EG"],
  ["+27", "ZA"],
  ["+30", "GR"],
  ["+31", "NL"],
  ["+32", "BE"],
  ["+33", "FR"],
  ["+34", "ES"],
  ["+36", "HU"],
  ["+39", "IT"],
  ["+40", "RO"],
  ["+41", "CH"],
  ["+43", "AT"],
  ["+44", "GB"],
  ["+45", "DK"],
  ["+46", "SE"],
  ["+47", "NO"],
  ["+48", "PL"],
  ["+49", "DE"],
  ["+52", "MX"],
  ["+54", "AR"],
  ["+55", "BR"],
  ["+56", "CL"],
  ["+57", "CO"],
  ["+58", "VE"],
  ["+60", "MY"],
  ["+61", "AU"],
  ["+62", "ID"],
  ["+63", "PH"],
  ["+64", "NZ"],
  ["+65", "SG"],
  ["+66", "TH"],
  ["+81", "JP"],
  ["+82", "KR"],
  ["+84", "VN"],
  ["+86", "CN"],
  ["+90", "TR"],
  ["+91", "IN"],
  ["+92", "PK"],
  ["+93", "AF"],
  ["+94", "LK"],
  ["+95", "MM"],
  ["+98", "IR"]
];

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
    formatExportList("Emails", lead?.emails),
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

export function createCsvFilename(value = new Date()) {
  return createExportFilename("csv", value);
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

function getLeadDomain(lead) {
  const storedHostname = String(lead?.hostname ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

  if (storedHostname) {
    return storedHostname;
  }

  try {
    return new URL(lead?.sourceUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getSocialUrl(link) {
  return link && typeof link === "object"
    ? String(link.url ?? "").trim()
    : String(link ?? "").trim();
}

function getSocialPlatform(link) {
  return link && typeof link === "object"
    ? String(link.platform ?? "").trim().toLowerCase()
    : "";
}

function callingNumber(value) {
  const formattedValue = formatExportPhone(value);

  if (/^https?:/i.test(formattedValue)) {
    try {
      const url = new URL(formattedValue);
      const candidate =
        url.searchParams.get("phone") ||
        (url.hostname.toLowerCase() === "wa.me"
          ? url.pathname.split("/").filter(Boolean)[0]
          : "");
      const digits = String(candidate ?? "").replace(/\D/g, "");
      return digits ? `+${digits.replace(/^00/, "")}` : "";
    } catch {
      return "";
    }
  }

  const compactValue = formattedValue.replace(/[^\d+]/g, "");

  if (compactValue.startsWith("+")) {
    return compactValue;
  }

  if (compactValue.startsWith("00")) {
    return `+${compactValue.slice(2)}`;
  }

  const matchingCode = COUNTRY_CALLING_CODES.find(([callingCode]) =>
    compactValue.startsWith(callingCode.slice(1))
  );

  return matchingCode ? `+${compactValue}` : "";
}

function inferCountry(lead) {
  const countries = new Set();
  const whatsappSocialLinks = (lead?.socialLinks ?? [])
    .filter((link) => getSocialPlatform(link) === "whatsapp")
    .map(getSocialUrl);

  for (const value of [
    ...(lead?.phones ?? []),
    ...(lead?.whatsapp ?? []),
    ...whatsappSocialLinks
  ]) {
    const phone = callingNumber(value);
    const country = COUNTRY_CALLING_CODES.find(([callingCode]) =>
      phone.startsWith(callingCode)
    )?.[1];

    if (country) {
      countries.add(country);
    }
  }

  return countries.size === 1 ? Array.from(countries)[0] : "";
}

function addNote(notes, label, values) {
  const cleanValues = values.filter(Boolean);

  if (cleanValues.length) {
    notes.push(`${label}: ${cleanValues.join(" | ")}`);
  }
}

function formatPhoneProvenance(phone) {
  if (!phone || typeof phone !== "object") {
    return "";
  }

  const number = formatExportPhone(phone);
  const source = String(phone.source ?? "").trim();
  const context = String(phone.context ?? "").trim();
  const details = [
    source ? `source=${source}` : "",
    context ? `context=${context}` : ""
  ].filter(Boolean);

  return number && details.length
    ? `${number} (${details.join(", ")})`
    : "";
}

export function mapLeadToCsvRow(lead) {
  const domain = getLeadDomain(lead);
  const phones = (lead?.phones ?? []).map(formatExportPhone).filter(Boolean);
  const whatsappNumbers = (lead?.whatsapp ?? [])
    .map(formatExportPhone)
    .filter(Boolean);
  const emails = (lead?.emails ?? []).map(String).filter(Boolean);
  const socialLinks = Array.isArray(lead?.socialLinks)
    ? lead.socialLinks
    : [];
  const whatsappSocialIndex = socialLinks.findIndex(
    (link) => getSocialPlatform(link) === "whatsapp"
  );
  const whatsappSocial =
    whatsappSocialIndex === -1 ? null : socialLinks[whatsappSocialIndex];
  const primaryWhatsapp =
    whatsappNumbers[0] || getSocialUrl(whatsappSocial);
  const excludedSocialIndexes = new Set();

  if (!whatsappNumbers.length && whatsappSocialIndex !== -1) {
    excludedSocialIndexes.add(whatsappSocialIndex);
  }

  const instagramIndex = socialLinks.findIndex(
    (link, index) =>
      !excludedSocialIndexes.has(index) &&
      getSocialPlatform(link) === "instagram"
  );
  const primarySocialIndex =
    instagramIndex !== -1
      ? instagramIndex
      : socialLinks.findIndex(
          (link, index) =>
            !excludedSocialIndexes.has(index) && Boolean(getSocialUrl(link))
        );
  const primarySocial =
    primarySocialIndex === -1
      ? ""
      : getSocialUrl(socialLinks[primarySocialIndex]);
  const otherSocials = socialLinks
    .filter(
      (_, index) =>
        index !== primarySocialIndex && !excludedSocialIndexes.has(index)
    )
    .map(formatExportSocialLink);
  const notes = [];
  const pageTitle = String(lead?.pageTitle ?? "").trim();
  const capturedAt = String(lead?.capturedAt ?? "").trim();
  const lastUpdatedAt = String(lead?.lastUpdatedAt ?? "").trim();

  if (pageTitle) {
    notes.push(`page title: ${pageTitle}`);
  }

  if (capturedAt) {
    notes.push(`captured at: ${capturedAt}`);
  }

  if (lastUpdatedAt) {
    notes.push(`last updated at: ${lastUpdatedAt}`);
  }

  addNote(notes, "other phones", phones.slice(1));
  addNote(notes, "other WhatsApp", whatsappNumbers.slice(1));
  addNote(
    notes,
    "phone details",
    (lead?.phones ?? []).map(formatPhoneProvenance)
  );
  addNote(
    notes,
    "WhatsApp details",
    (lead?.whatsapp ?? []).map(formatPhoneProvenance)
  );
  addNote(notes, "other emails", emails.slice(1));
  addNote(notes, "other socials", otherSocials);
  addNote(
    notes,
    "external links",
    (lead?.externalLinks ?? []).map(String)
  );

  return {
    name: domain,
    company_name: domain,
    phone: phones[0] || "",
    whatsapp: primaryWhatsapp || "",
    email: emails[0] || "",
    website: String(lead?.sourceUrl ?? "").trim(),
    social_url: primarySocial,
    country: inferCountry(lead),
    source: "chrome extension",
    notes: notes.join("; ")
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function formatLeadCollectionAsCsv(leads) {
  const leadList = Array.isArray(leads) ? leads : [];
  const rows = leadList.map(mapLeadToCsvRow);
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      CSV_HEADERS.map((header) => escapeCsvValue(row[header])).join(",")
    )
  ];

  return `${lines.join("\r\n")}\r\n`;
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

export async function downloadLeadCollectionAsCsv(
  leads,
  { exportedAt = new Date() } = {}
) {
  const exportDate = toValidDate(exportedAt);
  const csv = formatLeadCollectionAsCsv(leads);
  const filename = createCsvFilename(exportDate);

  return downloadUtf8File(csv, {
    filename,
    mimeType: "text/csv",
    includeBom: true
  });
}
