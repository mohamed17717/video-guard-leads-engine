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
