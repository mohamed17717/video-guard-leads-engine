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

const SOCIAL_PLATFORM_VALUES = new Set([
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "twitter",
  "telegram",
  "whatsapp",
  "snapchat",
  "other"
]);

const PHONE_SOURCE_PRIORITY = {
  "tel-link": 6,
  "whatsapp-link": 5,
  "meta-tag": 4,
  "button-text": 3,
  "anchor-text": 2,
  "visible-text": 1
};

function normalizeUnicodeDigits(value) {
  return String(value ?? "")
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660)
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0)
    );
}

function removePhoneDecorations(value) {
  let cleanedValue = normalizeUnicodeDigits(value).trim();

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
  const inputIsObject = value && typeof value === "object";
  const raw = String(
    inputIsObject
      ? value.raw ?? value.value ?? value.normalized ?? ""
      : value ?? ""
  ).trim();
  const cleanedValue = removePhoneDecorations(raw);
  const digits = cleanedValue.replace(/\D/g, "");
  let normalized = "";
  const context = inputIsObject
    ? String(value.context ?? "").replace(/\s+/g, " ").trim().slice(0, 200)
    : "";
  const source = inputIsObject
    ? String(value.source ?? "").trim()
    : "";

  if (!digits) {
    return {
      raw,
      normalized,
      ...(context ? { context } : {}),
      ...(source ? { source } : {})
    };
  }

  if (isEgyptianNationalNumber(digits)) {
    normalized = `+20${digits.slice(1)}`;
  } else if (isEgyptianInternationalDigits(digits)) {
    normalized = `+${digits}`;
  } else if (
    source === "whatsapp-link" &&
    !digits.startsWith("0") &&
    digits.length >= 8
  ) {
    normalized = `+${digits}`;
  } else if (cleanedValue.startsWith("00") && digits.length > 2) {
    normalized = `+${digits.slice(2)}`;
  } else if (cleanedValue.startsWith("+")) {
    normalized = `+${digits}`;
  } else {
    normalized = digits;
  }

  return {
    raw,
    normalized,
    ...(context ? { context } : {}),
    ...(source ? { source } : {})
  };
}

function choosePhoneMetadata(existingPhone, incomingPhone) {
  const existingPriority =
    PHONE_SOURCE_PRIORITY[existingPhone?.source] ?? 0;
  const incomingPriority =
    PHONE_SOURCE_PRIORITY[incomingPhone?.source] ?? 0;

  if (
    incomingPriority > existingPriority ||
    (!existingPhone?.context && incomingPhone?.context)
  ) {
    return incomingPhone;
  }

  return existingPhone;
}

export function normalizePhoneNumbers(values) {
  const uniqueNumbers = new Map();

  for (const value of values ?? []) {
    const phone = normalizePhoneNumber(value);

    if (!phone.normalized) {
      continue;
    }

    const existingPhone = uniqueNumbers.get(phone.normalized);
    uniqueNumbers.set(
      phone.normalized,
      existingPhone
        ? choosePhoneMetadata(existingPhone, phone)
        : phone
    );
  }

  return Array.from(uniqueNumbers.values());
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim();
  const separatorIndex = email.lastIndexOf("@");

  if (separatorIndex <= 0) {
    return "";
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1).toLowerCase();

  if (
    !domain.includes(".") ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.includes("..")
  ) {
    return "";
  }

  return `${localPart}@${domain}`;
}

export function normalizeEmails(values) {
  const uniqueEmails = new Map();

  for (const value of values ?? []) {
    const email = normalizeEmail(value);
    const key = email.toLowerCase();

    if (email && !uniqueEmails.has(key)) {
      uniqueEmails.set(key, email);
    }
  }

  return Array.from(uniqueEmails.values());
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

export function normalizeSocialPlatform(value) {
  const platform = String(value ?? "").trim().toLowerCase();

  if (platform === "x") {
    return "twitter";
  }

  return SOCIAL_PLATFORM_VALUES.has(platform) ? platform : "other";
}

export function normalizeSocialLinks(values, baseUrl) {
  const uniqueLinks = new Map();

  for (const value of values ?? []) {
    const platform = normalizeSocialPlatform(value?.platform);
    const rawUrl = String(value?.url ?? "").trim();
    const normalizedUrl = /^whatsapp:/i.test(rawUrl)
      ? rawUrl
      : normalizeUrl(rawUrl, baseUrl);

    if (!platform || !normalizedUrl) {
      continue;
    }

    const existing = uniqueLinks.get(normalizedUrl);

    if (
      !existing ||
      (existing.platform === "other" && platform !== "other")
    ) {
      uniqueLinks.set(normalizedUrl, { platform, url: normalizedUrl });
    }
  }

  return Array.from(uniqueLinks.values());
}

function normalizeLinkText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= 160
    ? text
    : `${text.slice(0, 159).trimEnd()}…`;
}

export function normalizeExternalLinks(values, baseUrl = undefined) {
  const uniqueLinks = new Map();

  for (const value of values ?? []) {
    const inputIsObject = value && typeof value === "object";
    const rawUrl = inputIsObject ? value.url : value;
    const url = normalizeUrl(rawUrl, baseUrl);

    if (!url) {
      continue;
    }

    const link = {
      url,
      text: inputIsObject ? normalizeLinkText(value.text) : "",
      type: "website"
    };
    const existing = uniqueLinks.get(url);

    if (!existing || (!existing.text && link.text)) {
      uniqueLinks.set(url, link);
    }
  }

  return Array.from(uniqueLinks.values());
}

export function normalizeExtractedData(data) {
  const rawSourceUrl = String(data?.sourceUrl ?? "").trim();
  const sourceUrl = normalizeUrl(rawSourceUrl) || rawSourceUrl;
  const socialLinks = normalizeSocialLinks(data?.socialLinks, sourceUrl);
  const socialUrls = new Set(socialLinks.map(({ url }) => url));
  const externalLinks = normalizeExternalLinks(
    data?.externalLinks,
    sourceUrl
  ).filter(
    ({ url }) => url !== sourceUrl && !socialUrls.has(url)
  );
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
    emails: normalizeEmails(data?.emails),
    socialLinks,
    externalLinks
  };
}
