const EGYPT_MOBILE_PATTERN = /^01[0125]\d{8}$/;
const EGYPT_CAIRO_LANDLINE_PATTERN = /^02\d{8}$/;
const EGYPT_ALEXANDRIA_LANDLINE_PATTERN = /^03\d{7}$/;
const EGYPT_REGIONAL_AREA_CODES = [
  "40",
  "45",
  "46",
  "47",
  "48",
  "50",
  "55",
  "57",
  "62",
  "64",
  "65",
  "66",
  "68",
  "69",
  "82",
  "84",
  "86",
  "88",
  "92",
  "93",
  "95",
  "97"
];

const TRACKING_PARAMETERS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "gbraid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "wbraid"
]);

function removePhoneDecorations(value) {
  let cleanedValue = String(value ?? "").trim();

  try {
    cleanedValue = decodeURIComponent(cleanedValue);
  } catch {
    // Preserve malformed percent-encoded input instead of rejecting it.
  }

  return cleanedValue
    .replace(/^tel:/i, "")
    .split(/[;?]/, 1)[0]
    .replace(/[\s\u00a0()\-]/g, "")
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");
}

function isEgyptianNationalNumber(digits) {
  if (
    EGYPT_MOBILE_PATTERN.test(digits) ||
    EGYPT_CAIRO_LANDLINE_PATTERN.test(digits) ||
    EGYPT_ALEXANDRIA_LANDLINE_PATTERN.test(digits)
  ) {
    return true;
  }

  return EGYPT_REGIONAL_AREA_CODES.some((areaCode) =>
    new RegExp(`^0${areaCode}\\d{7}$`).test(digits)
  );
}

function isEgyptianInternationalDigits(digits) {
  return digits.startsWith("20") &&
    isEgyptianNationalNumber(`0${digits.slice(2)}`);
}

export function normalizePhoneNumber(value) {
  const raw = String(value ?? "").trim();
  const cleanedValue = removePhoneDecorations(raw);
  const digits = cleanedValue.replace(/\D/g, "");
  let normalized = "";

  if (!digits) {
    return { raw, normalized };
  }

  if (isEgyptianNationalNumber(digits)) {
    normalized = `+20${digits.slice(1)}`;
  } else if (isEgyptianInternationalDigits(digits)) {
    normalized = `+${digits}`;
  } else if (cleanedValue.startsWith("00") && digits.length > 2) {
    normalized = `+${digits.slice(2)}`;
  } else if (cleanedValue.startsWith("+")) {
    normalized = `+${digits}`;
  } else {
    normalized = digits;
  }

  return { raw, normalized };
}

export function normalizePhoneNumbers(values) {
  const uniqueNumbers = new Map();

  for (const value of values ?? []) {
    const phone = normalizePhoneNumber(value);

    if (phone.normalized && !uniqueNumbers.has(phone.normalized)) {
      uniqueNumbers.set(phone.normalized, phone);
    }
  }

  return Array.from(uniqueNumbers.values());
}

function isTrackingParameter(name) {
  const normalizedName = name.toLowerCase();
  return (
    normalizedName.startsWith("utm_") ||
    TRACKING_PARAMETERS.has(normalizedName)
  );
}

function removeTrackingParameters(url) {
  const parameterNames = Array.from(url.searchParams.keys());

  for (const name of parameterNames) {
    if (isTrackingParameter(name)) {
      url.searchParams.delete(name);
    }
  }
}

function removeUnimportantTrailingSlash(url) {
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }

  return url.href.replace(/\/(?=[?#]|$)/, "");
}

export function normalizeUrl(value, baseUrl = undefined) {
  const rawUrl = String(value ?? "").trim();

  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl, baseUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    url.hash = "";
    removeTrackingParameters(url);

    return removeUnimportantTrailingSlash(url);
  } catch {
    return "";
  }
}

export function normalizeUrls(values, baseUrl = undefined) {
  const uniqueUrls = new Set();

  for (const value of values ?? []) {
    const normalizedUrl = normalizeUrl(value, baseUrl);

    if (normalizedUrl) {
      uniqueUrls.add(normalizedUrl);
    }
  }

  return Array.from(uniqueUrls);
}

function normalizeSocialLinks(values, baseUrl) {
  const uniqueLinks = new Map();

  for (const value of values ?? []) {
    const platform = String(value?.platform ?? "").trim().toLowerCase();
    const rawUrl = String(value?.url ?? "").trim();
    const normalizedUrl = /^whatsapp:/i.test(rawUrl)
      ? rawUrl
      : normalizeUrl(rawUrl, baseUrl);

    if (!platform || !normalizedUrl) {
      continue;
    }

    const key = `${platform}:${normalizedUrl}`;

    if (!uniqueLinks.has(key)) {
      uniqueLinks.set(key, { platform, url: normalizedUrl });
    }
  }

  return Array.from(uniqueLinks.values());
}

export function normalizeExtractedData(data) {
  const rawSourceUrl = String(data?.sourceUrl ?? "").trim();
  const sourceUrl = normalizeUrl(rawSourceUrl) || rawSourceUrl;
  let hostname = String(data?.hostname ?? "").trim();

  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    // Retain the extracted hostname when the source URL is unusual.
  }

  return {
    pageTitle: String(data?.pageTitle ?? "").trim(),
    sourceUrl,
    hostname,
    capturedAt: String(data?.capturedAt ?? ""),
    phones: normalizePhoneNumbers(data?.phones),
    whatsapp: normalizePhoneNumbers(data?.whatsapp),
    socialLinks: normalizeSocialLinks(data?.socialLinks, sourceUrl),
    externalLinks: normalizeUrls(data?.externalLinks, sourceUrl)
  };
}
