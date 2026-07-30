const PHONE_CANDIDATE_PATTERN =
  /(?:\+|00)?\d(?:[ \t\u00a0().-]*\d){6,18}/g;

const EMAIL_PATTERN =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?\.(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})/gi;

const PHONE_CUE_PATTERN =
  /\b(?:call|contact|mobile|mob|phone|tel|telephone|whats[\s-]*app|wa)\b|(?:اتصل|تليفون|هاتف|موبايل|واتس\s*اب)/i;

const NON_PHONE_CUE_PATTERN =
  /\b(?:account|customer|invoice|item|order|product|reference|ref|sku|tracking|user)\s*(?:id|no|number|#)?\b/i;

const PRICE_CUE_PATTERN =
  /(?:[$€£¥]|(?:\b(?:aed|egp|eur|gbp|price|sar|usd)\b)|(?:جنيه|ريال|السعر))/i;

const COMMON_CONTACT_SELECTOR = [
  "address",
  "footer",
  "[id*='contact' i]",
  "[class*='contact' i]",
  "[id*='phone' i]",
  "[class*='phone' i]",
  "[id*='email' i]",
  "[class*='email' i]",
  "[id*='whatsapp' i]",
  "[class*='whatsapp' i]"
].join(", ");

const RELEVANT_META_PATTERN =
  /(?:contact|description|email|mobile|phone|telephone|whats[\s-]*app)/i;

const WHATSAPP_WIDGET_SELECTOR = [
  "[class*='whatsapp' i]",
  "[id*='whatsapp' i]",
  "[class*='joinchat' i]",
  "[id*='joinchat' i]",
  "[aria-label*='whatsapp' i]",
  "[data-whatsapp]",
  "[data-wa-number]",
  "[data-telephone][role='button']",
  "[data-phone][role='button']",
  "[data-settings]",
  "[onclick*='whatsapp' i]",
  "[onclick*='wa.me' i]"
].join(", ");

const PHONE_ATTRIBUTE_PATTERN =
  /(?:^|[-_:])(?:telephone|phone|mobile|whatsapp|wa[-_]?number|number)(?:$|[-_:])/i;

const WHATSAPP_WIDGET_SIGNAL_PATTERN =
  /(?:whats[\s_-]*app|joinchat|wa\.me|whatsapp:\/\/)/i;

const SOCIAL_DOMAINS = [
  { platform: "facebook", domains: ["facebook.com", "fb.com", "fb.me"] },
  { platform: "instagram", domains: ["instagram.com"] },
  { platform: "tiktok", domains: ["tiktok.com"] },
  { platform: "youtube", domains: ["youtube.com", "youtu.be"] },
  { platform: "linkedin", domains: ["linkedin.com"] },
  { platform: "x", domains: ["x.com", "twitter.com"] },
  {
    platform: "telegram",
    domains: ["t.me", "telegram.me", "telegram.org"]
  },
  {
    platform: "whatsapp",
    domains: ["wa.me", "whatsapp.com"]
  },
  { platform: "snapchat", domains: ["snapchat.com"] }
];

function safeQueryAll(root, selector) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function getElementText(element) {
  if (!element) {
    return "";
  }

  const text =
    typeof element.innerText === "string"
      ? element.innerText
      : element.textContent;

  return typeof text === "string" ? text.trim() : "";
}

function getAttribute(element, name) {
  if (!element || typeof element.getAttribute !== "function") {
    return "";
  }

  return element.getAttribute(name) ?? "";
}

function getAttributeNames(element) {
  if (!element || typeof element.getAttributeNames !== "function") {
    return [];
  }

  return element.getAttributeNames();
}

function getVisiblePageText(documentRoot) {
  return getElementText(documentRoot?.body);
}

function cleanPhoneValue(value) {
  let decodedValue = String(value ?? "");

  try {
    decodedValue = decodeURIComponent(decodedValue);
  } catch {
    // Keep the original value when malformed percent encoding is encountered.
  }

  return decodedValue
    .replace(/^tel:/i, "")
    .split(/[;?]/, 1)[0]
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/^[^\d+]+|[^\d)]+$/g, "")
    .trim();
}

function phoneKey(value) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  return digits;
}

function uniquePhoneValues(values) {
  const uniqueValues = new Map();

  for (const value of values) {
    const cleanedValue = cleanPhoneValue(value);
    const key = phoneKey(cleanedValue);

    if (key && !uniqueValues.has(key)) {
      uniqueValues.set(key, cleanedValue);
    }
  }

  return Array.from(uniqueValues.values());
}

function isValidCalendarDate(year, month, day) {
  if (
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function groupsContainCalendarDate(groups) {
  for (let index = 0; index <= groups.length - 3; index += 1) {
    const first = Number(groups[index]);
    const second = Number(groups[index + 1]);
    const third = Number(groups[index + 2]);

    if (
      isValidCalendarDate(first, second, third) ||
      isValidCalendarDate(third, second, first) ||
      isValidCalendarDate(third, first, second)
    ) {
      return true;
    }
  }

  return false;
}

function looksLikeDate(value, digits) {
  const numericGroups = value.match(/\d+/g) ?? [];

  if (groupsContainCalendarDate(numericGroups)) {
    return true;
  }

  if (
    /^(?:19|20)\d{2}[ \t.-]+(?:19|20)\d{2}$/.test(value.trim())
  ) {
    return true;
  }

  if (digits.length === 8) {
    const yearFirst = Number(digits.slice(0, 4));
    const yearLast = Number(digits.slice(4, 8));

    if (
      isValidCalendarDate(
        yearFirst,
        Number(digits.slice(4, 6)),
        Number(digits.slice(6, 8))
      ) ||
      isValidCalendarDate(
        yearLast,
        Number(digits.slice(2, 4)),
        Number(digits.slice(0, 2))
      ) ||
      isValidCalendarDate(
        yearLast,
        Number(digits.slice(0, 2)),
        Number(digits.slice(2, 4))
      )
    ) {
      return true;
    }
  }

  return false;
}

function isRecognizedEgyptianNumber(digits) {
  return (
    /^01[0125]\d{8}$/.test(digits) ||
    /^201[0125]\d{8}$/.test(digits) ||
    /^0[2-9]\d{7,8}$/.test(digits) ||
    /^20[2-9]\d{7,8}$/.test(digits)
  );
}

function isLikelyPhoneNumber(value, context = "", explicit = false) {
  const cleanedValue = cleanPhoneValue(value);
  const digits = phoneKey(cleanedValue);

  if (digits.length < 8 || digits.length > 15) {
    return false;
  }

  if (/^(\d)\1+$/.test(digits) || looksLikeDate(cleanedValue, digits)) {
    return false;
  }

  if (PRICE_CUE_PATTERN.test(context)) {
    return false;
  }

  if (explicit) {
    return true;
  }

  if (NON_PHONE_CUE_PATTERN.test(context)) {
    return false;
  }

  if (isRecognizedEgyptianNumber(digits)) {
    return true;
  }

  if (/^(?:\+|00)/.test(cleanedValue)) {
    return true;
  }

  if (PHONE_CUE_PATTERN.test(context)) {
    return true;
  }

  // Formatting is a useful signal for numbers without a nearby contact label.
  // Plain, unlabelled digit sequences are intentionally rejected to reduce IDs.
  return /[ ()-]/.test(cleanedValue);
}

function extractPhoneMatches(text, { explicit = false } = {}) {
  const input = String(text ?? "");
  const matches = [];

  for (const match of input.matchAll(PHONE_CANDIDATE_PATTERN)) {
    const value = cleanPhoneValue(match[0]);
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const lineStart = input.lastIndexOf("\n", start - 1) + 1;
    const nextLineBreak = input.indexOf("\n", end);
    const lineEnd = nextLineBreak === -1 ? input.length : nextLineBreak;
    const context = input.slice(
      Math.max(lineStart, start - 36),
      Math.min(lineEnd, end + 36)
    );

    if (isLikelyPhoneNumber(value, context, explicit)) {
      matches.push({ value, start, end });
    }
  }

  return matches;
}

export function extractPhonesFromText(text, options = {}) {
  return uniquePhoneValues(
    extractPhoneMatches(text, options).map(({ value }) => value)
  );
}

function normalizeExtractedEmail(value) {
  const email = String(value ?? "")
    .trim()
    .replace(/^[<("'[]+|[>)"',.;:\]]+$/g, "");
  const separatorIndex = email.lastIndexOf("@");

  if (separatorIndex <= 0) {
    return "";
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1).toLowerCase();

  if (
    email.length > 254 ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.includes("..")
  ) {
    return "";
  }

  return `${localPart}@${domain}`;
}

function uniqueEmailValues(values) {
  const uniqueValues = new Map();

  for (const value of values) {
    const email = normalizeExtractedEmail(value);
    const key = email.toLowerCase();

    if (email && !uniqueValues.has(key)) {
      uniqueValues.set(key, email);
    }
  }

  return Array.from(uniqueValues.values());
}

function revealObfuscatedEmails(text) {
  return String(text ?? "").replace(
    /([a-z0-9.!#$%&'*+/=?^_`{|}~-]+)\s*(?:\[at\]|\(at\)|\bat\b)\s*([a-z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\bdot\b)\s*([a-z]{2,63})/gi,
    "$1@$2.$3"
  );
}

export function extractEmailsFromText(text) {
  const input = revealObfuscatedEmails(text);
  return uniqueEmailValues(Array.from(input.matchAll(EMAIL_PATTERN), (match) => match[0]));
}

function collectContactTextSources(documentRoot) {
  const sources = [getVisiblePageText(documentRoot)];

  for (const anchor of safeQueryAll(documentRoot, "a[href]")) {
    sources.push(getElementText(anchor));
  }

  for (const button of safeQueryAll(
    documentRoot,
    "button, [role='button']"
  )) {
    sources.push(getElementText(button));
  }

  for (const section of safeQueryAll(
    documentRoot,
    COMMON_CONTACT_SELECTOR
  )) {
    sources.push(getElementText(section));
  }

  for (const meta of safeQueryAll(documentRoot, "meta[content]")) {
    const descriptor = [
      getAttribute(meta, "name"),
      getAttribute(meta, "property"),
      getAttribute(meta, "itemprop")
    ].join(" ");
    const content = getAttribute(meta, "content");

    if (
      RELEVANT_META_PATTERN.test(descriptor) ||
      PHONE_CUE_PATTERN.test(content)
    ) {
      sources.push(content);
    }
  }

  return sources.filter(Boolean);
}

export function extractPhoneNumbers(documentRoot) {
  const values = collectContactTextSources(documentRoot).flatMap((text) =>
    extractPhonesFromText(text)
  );

  for (const anchor of safeQueryAll(documentRoot, "a[href]")) {
    const href = getAttribute(anchor, "href").trim();

    if (href.toLowerCase().startsWith("tel:")) {
      values.push(...extractPhonesFromText(href.slice(4), { explicit: true }));
    }
  }

  return uniquePhoneValues(values);
}

export function extractEmailAddresses(documentRoot) {
  const values = collectContactTextSources(documentRoot).flatMap((text) =>
    extractEmailsFromText(text)
  );

  for (const anchor of safeQueryAll(documentRoot, "a[href]")) {
    const href = getAttribute(anchor, "href").trim();

    if (!href.toLowerCase().startsWith("mailto:")) {
      continue;
    }

    let addressValue = href.slice(7).split(/[?#]/, 1)[0];

    try {
      addressValue = decodeURIComponent(addressValue);
    } catch {
      // Keep malformed percent encoding and extract any readable address.
    }

    for (const address of addressValue.split(/[;,]/)) {
      values.push(...extractEmailsFromText(address));
    }
  }

  for (const element of safeQueryAll(documentRoot, "[data-email]")) {
    values.push(...extractEmailsFromText(getAttribute(element, "data-email")));
  }

  return uniqueEmailValues(values);
}

function normalizeHttpUrl(url, baseUrl = undefined) {
  try {
    const parsedUrl = new URL(url, baseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "";
    }

    parsedUrl.hash = "";
    return parsedUrl.href;
  } catch {
    return "";
  }
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function classifySocialUrl(url, baseUrl = undefined) {
  const rawUrl = String(url ?? "").trim();

  if (/^whatsapp:/i.test(rawUrl)) {
    return "whatsapp";
  }

  const normalizedUrl = normalizeHttpUrl(rawUrl, baseUrl);

  if (!normalizedUrl) {
    return null;
  }

  const hostname = new URL(normalizedUrl).hostname.toLowerCase();
  const match = SOCIAL_DOMAINS.find(({ domains }) =>
    domains.some((domain) => domainMatches(hostname, domain))
  );

  return match?.platform ?? null;
}

function getAnchorUrls(documentRoot) {
  return safeQueryAll(documentRoot, "a[href]")
    .map((anchor) => getAttribute(anchor, "href").trim())
    .filter(Boolean);
}

function normalizeWhatsappUrl(url, baseUrl = undefined) {
  const rawUrl = String(url ?? "").trim();

  if (/^whatsapp:/i.test(rawUrl)) {
    return rawUrl;
  }

  return normalizeHttpUrl(rawUrl, baseUrl);
}

function getWhatsappNumberFromUrl(url, baseUrl = undefined) {
  const rawUrl = String(url ?? "").trim();

  if (classifySocialUrl(rawUrl, baseUrl) !== "whatsapp") {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl, baseUrl);
    const queryNumber =
      parsedUrl.searchParams.get("phone") ??
      parsedUrl.searchParams.get("number");
    let candidate = queryNumber;

    if (!candidate && domainMatches(parsedUrl.hostname.toLowerCase(), "wa.me")) {
      candidate = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (!candidate) {
      return "";
    }

    let digits = candidate.replace(/\D/g, "");

    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    }

    return digits.length >= 8 && digits.length <= 15 ? digits : "";
  } catch {
    return "";
  }
}

function extractWhatsappNumbersFromAttributeValue(
  value,
  baseUrl = undefined
) {
  const input = String(value ?? "").replace(/\\\//g, "/");
  const numbers = [];
  const urlPattern =
    /(?:https?:\/\/)?(?:wa\.me\/[^\s"'<>]+|(?:api|web)\.whatsapp\.com\/[^\s"'<>]+)|whatsapp:\/\/[^\s"'<>]+/gi;

  for (const match of input.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const url = /^wa\.me\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
    const phone = getWhatsappNumberFromUrl(url, baseUrl);

    if (phone) {
      numbers.push(phone);
    }
  }

  return numbers;
}

function collectPhonesFromWidgetSettings(
  value,
  baseUrl,
  key = "",
  output = []
) {
  if (value === null || value === undefined) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPhonesFromWidgetSettings(item, baseUrl, key, output);
    }
    return output;
  }

  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectPhonesFromWidgetSettings(
        childValue,
        baseUrl,
        childKey,
        output
      );
    }
    return output;
  }

  const stringValue = String(value);

  if (PHONE_ATTRIBUTE_PATTERN.test(key)) {
    output.push(
      ...extractPhonesFromText(stringValue, { explicit: true })
    );
  }

  output.push(
    ...extractWhatsappNumbersFromAttributeValue(stringValue, baseUrl)
  );
  return output;
}

function parseWidgetSettings(value, baseUrl) {
  const input = String(value ?? "").trim();

  if (!input) {
    return [];
  }

  try {
    return collectPhonesFromWidgetSettings(
      JSON.parse(input),
      baseUrl
    );
  } catch {
    const numbers = [];
    const labeledNumberPattern =
      /(?:telephone|phone|mobile|whatsapp|wa[-_]?number|number)["'\s:=\\]+(\+?\d(?:[\s().-]*\d){7,14})/gi;

    for (const match of input.matchAll(labeledNumberPattern)) {
      numbers.push(
        ...extractPhonesFromText(match[1], { explicit: true })
      );
    }

    numbers.push(
      ...extractWhatsappNumbersFromAttributeValue(input, baseUrl)
    );
    return numbers;
  }
}

export function extractWhatsappWidgetNumbers(
  documentRoot,
  baseUrl = undefined
) {
  const phones = [];

  for (const element of safeQueryAll(
    documentRoot,
    WHATSAPP_WIDGET_SELECTOR
  )) {
    const attributeNames = getAttributeNames(element);
    const descriptor = attributeNames
      .map((name) => `${name} ${getAttribute(element, name)}`)
      .join(" ");
    const role = getAttribute(element, "role").toLowerCase();
    const hasDirectPhoneAttribute = attributeNames.some((name) =>
      PHONE_ATTRIBUTE_PATTERN.test(name)
    );
    const isWhatsappWidget =
      WHATSAPP_WIDGET_SIGNAL_PATTERN.test(descriptor) ||
      (role === "button" && hasDirectPhoneAttribute);

    if (!isWhatsappWidget) {
      continue;
    }

    for (const attributeName of attributeNames) {
      const attributeValue = getAttribute(element, attributeName);

      if (PHONE_ATTRIBUTE_PATTERN.test(attributeName)) {
        phones.push(
          ...extractPhonesFromText(attributeValue, { explicit: true })
        );
      }

      if (/^data-(?:settings|config|options)$/i.test(attributeName)) {
        phones.push(...parseWidgetSettings(attributeValue, baseUrl));
      }

      phones.push(
        ...extractWhatsappNumbersFromAttributeValue(
          attributeValue,
          baseUrl
        )
      );
    }
  }

  return uniquePhoneValues(phones);
}

function extractWhatsappNumbersNearMentions(text) {
  const input = String(text ?? "");
  const values = [];
  const mentionPattern = /whats[\s-]*app|واتس\s*اب/gi;

  for (const match of input.matchAll(mentionPattern)) {
    const start = match.index ?? 0;
    const nearbyText = input.slice(
      Math.max(0, start - 90),
      start + match[0].length + 90
    );
    values.push(...extractPhonesFromText(nearbyText));
  }

  return values;
}

export function extractWhatsappInfo(documentRoot, baseUrl = undefined) {
  const links = [];
  const phones = [];

  for (const href of getAnchorUrls(documentRoot)) {
    if (classifySocialUrl(href, baseUrl) !== "whatsapp") {
      continue;
    }

    const normalizedUrl = normalizeWhatsappUrl(href, baseUrl);
    const phone = getWhatsappNumberFromUrl(href, baseUrl);

    if (normalizedUrl) {
      links.push(normalizedUrl);
    }

    if (phone) {
      phones.push(phone);
    }
  }

  phones.push(
    ...extractWhatsappNumbersNearMentions(getVisiblePageText(documentRoot))
  );
  phones.push(
    ...extractWhatsappWidgetNumbers(documentRoot, baseUrl)
  );

  return {
    links: Array.from(new Set(links)),
    phones: uniquePhoneValues(phones)
  };
}

export function extractSocialLinks(documentRoot, baseUrl = undefined) {
  const uniqueLinks = new Map();

  for (const href of getAnchorUrls(documentRoot)) {
    const platform = classifySocialUrl(href, baseUrl);

    if (!platform) {
      continue;
    }

    const normalizedUrl =
      platform === "whatsapp"
        ? normalizeWhatsappUrl(href, baseUrl)
        : normalizeHttpUrl(href, baseUrl);

    if (!normalizedUrl) {
      continue;
    }

    const key = `${platform}:${normalizedUrl}`;

    if (!uniqueLinks.has(key)) {
      uniqueLinks.set(key, { platform, url: normalizedUrl });
    }
  }

  return Array.from(uniqueLinks.values());
}

export function extractExternalLinks(documentRoot, sourceUrl) {
  const normalizedSourceUrl = normalizeHttpUrl(sourceUrl);
  const sourceHostname = normalizedSourceUrl
    ? new URL(normalizedSourceUrl).hostname.toLowerCase()
    : "";
  const uniqueLinks = new Set();

  for (const href of getAnchorUrls(documentRoot)) {
    if (
      !href ||
      href.startsWith("#") ||
      /^(?:javascript|mailto|tel):/i.test(href)
    ) {
      continue;
    }

    if (classifySocialUrl(href, normalizedSourceUrl)) {
      continue;
    }

    const normalizedUrl = normalizeHttpUrl(href, normalizedSourceUrl);

    if (!normalizedUrl || normalizedUrl === normalizedSourceUrl) {
      continue;
    }

    if (
      sourceHostname &&
      new URL(normalizedUrl).hostname.toLowerCase() === sourceHostname
    ) {
      continue;
    }

    uniqueLinks.add(normalizedUrl);
  }

  return Array.from(uniqueLinks);
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

export function extractPageMetadata(
  documentRoot,
  { sourceUrl, capturedAt } = {}
) {
  const resolvedSourceUrl =
    sourceUrl ??
    documentRoot?.location?.href ??
    documentRoot?.defaultView?.location?.href ??
    "";
  let hostname = "";

  try {
    hostname = new URL(resolvedSourceUrl).hostname;
  } catch {
    // Keep hostname empty when the page does not have a normal URL.
  }

  return {
    pageTitle: String(documentRoot?.title ?? "").trim(),
    sourceUrl: resolvedSourceUrl,
    hostname,
    capturedAt: toIsoTimestamp(capturedAt)
  };
}

export function extractPageData(documentRoot = globalThis.document, options = {}) {
  const metadata = extractPageMetadata(documentRoot, options);
  const whatsappInfo = extractWhatsappInfo(
    documentRoot,
    metadata.sourceUrl
  );
  const phones = uniquePhoneValues([
    ...extractPhoneNumbers(documentRoot),
    ...whatsappInfo.phones
  ]);

  return {
    ...metadata,
    phones,
    whatsapp: whatsappInfo.phones,
    emails: extractEmailAddresses(documentRoot),
    socialLinks: extractSocialLinks(documentRoot, metadata.sourceUrl),
    externalLinks: extractExternalLinks(documentRoot, metadata.sourceUrl)
  };
}
