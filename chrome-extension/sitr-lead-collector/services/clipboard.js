import { formatLeadCollectionAsText } from "./exporter.js";

function uniqueLines(values) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  ).join("\n");
}

function phoneValue(phone) {
  if (phone && typeof phone === "object") {
    return phone.normalized || phone.raw || "";
  }

  return phone;
}

function linkUrl(link) {
  return link && typeof link === "object" ? link.url : link;
}

export function formatPhoneNumbersForCopy(values) {
  return uniqueLines((values ?? []).map(phoneValue));
}

export function formatSocialLinksForCopy(values) {
  return uniqueLines((values ?? []).map(linkUrl));
}

export function formatExternalLinksForCopy(values) {
  return uniqueLines((values ?? []).map(linkUrl));
}

export function formatLeadsForCopy(
  leads,
  { exportedAt = new Date() } = {}
) {
  return formatLeadCollectionAsText(leads, { exportedAt });
}

export async function copyTextToClipboard(
  value,
  {
    clipboard = globalThis.navigator?.clipboard,
    documentRoot = globalThis.document
  } = {}
) {
  const text = String(value ?? "");

  if (!text) {
    throw new Error("There is no text to copy.");
  }

  try {
    if (typeof clipboard?.writeText !== "function") {
      throw new Error("Clipboard API is unavailable.");
    }

    await clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    if (
      !documentRoot?.body ||
      typeof documentRoot.execCommand !== "function"
    ) {
      throw clipboardError;
    }

    const textArea = documentRoot.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    documentRoot.body.append(textArea);
    textArea.select();
    const copied = documentRoot.execCommand("copy");
    textArea.remove();

    if (!copied) {
      throw new Error("Clipboard copy failed.");
    }
  }
}
