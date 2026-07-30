import { getLeadCount } from "../services/storage.js";
import { normalizeExtractedData } from "../services/normalizer.js";

const statusMessage = document.querySelector("#status-message");
const leadCount = document.querySelector("#lead-count");
const captureButton = document.querySelector("#capture-page");
const preview = document.querySelector("#lead-preview");
const saveLeadButton = document.querySelector("#save-lead");
const cancelPreviewButton = document.querySelector("#cancel-preview");

let pendingLead = null;

const placeholderActions = {
  "#view-leads": "The collected leads view will be added in a later task.",
  "#export-txt": "TXT export will be added in a later task.",
  "#export-json": "JSON export will be added in a later task.",
  "#clear-all": "Clearing collected leads will be added in a later task."
};

function setStatus(message, state = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

for (const [selector, message] of Object.entries(placeholderActions)) {
  document.querySelector(selector).addEventListener("click", () => {
    setStatus(message);
  });
}

function isAccessiblePageUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function setCaptureLoading(isLoading) {
  captureButton.disabled = isLoading;
  captureButton.textContent = isLoading
    ? "Capturing…"
    : "Capture This Page";
}

function clearList(list) {
  list.replaceChildren();
}

function appendEmptyValue(list) {
  const item = document.createElement("li");
  item.textContent = "None found";
  list.append(item);
}

function renderPhoneList(selector, phones) {
  const list = document.querySelector(selector);
  clearList(list);

  if (!phones.length) {
    appendEmptyValue(list);
    return;
  }

  for (const phone of phones) {
    const item = document.createElement("li");
    item.textContent =
      phone.raw && phone.raw !== phone.normalized
        ? `${phone.raw} → ${phone.normalized}`
        : phone.normalized;
    list.append(item);
  }
}

function renderLinkList(selector, links, getLabel) {
  const list = document.querySelector(selector);
  clearList(list);

  if (!links.length) {
    appendEmptyValue(list);
    return;
  }

  for (const link of links) {
    const url = typeof link === "string" ? link : link.url;
    const item = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = getLabel(link);
    item.append(anchor);
    list.append(item);
  }
}

function setCount(id, value) {
  document.querySelector(id).textContent = String(value);
}

function getUsefulValueCount(lead) {
  return (
    lead.phones.length +
    lead.whatsapp.length +
    lead.socialLinks.length +
    lead.externalLinks.length
  );
}

function renderPreview(lead) {
  document.querySelector("#preview-page").textContent =
    lead.pageTitle || lead.hostname || "Untitled page";

  setCount("#preview-phone-count", lead.phones.length);
  setCount("#preview-whatsapp-count", lead.whatsapp.length);
  setCount("#preview-social-count", lead.socialLinks.length);
  setCount("#preview-external-count", lead.externalLinks.length);
  setCount("#phone-section-count", lead.phones.length);
  setCount("#whatsapp-section-count", lead.whatsapp.length);
  setCount("#social-section-count", lead.socialLinks.length);
  setCount("#external-section-count", lead.externalLinks.length);

  renderPhoneList("#preview-phones", lead.phones);
  renderPhoneList("#preview-whatsapp", lead.whatsapp);
  renderLinkList(
    "#preview-social",
    lead.socialLinks,
    ({ platform, url }) => `${platform}: ${url}`
  );
  renderLinkList("#preview-external", lead.externalLinks, (url) => url);

  const hasUsefulData = getUsefulValueCount(lead) > 0;
  saveLeadButton.disabled = !hasUsefulData;
  preview.hidden = false;
}

function hidePreview() {
  pendingLead = null;
  preview.hidden = true;
  saveLeadButton.disabled = true;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scripts/content.js"]
  });
  const result = results?.[0]?.result;

  if (!result || typeof result !== "object") {
    throw new Error("The extraction script returned no page data.");
  }

  return result;
}

function getCaptureErrorMessage(error) {
  const message = String(error?.message ?? error);

  if (
    /cannot access|cannot be scripted|missing host permission|not allowed|permission|blocked/i.test(
      message
    )
  ) {
    return "This page blocks extension script execution.";
  }

  return "Extraction failed. Reload the page and try again.";
}

async function captureCurrentPage() {
  hidePreview();
  setCaptureLoading(true);
  setStatus("Reading the active page…");

  try {
    const tab = await getActiveTab();

    if (!tab?.url) {
      setStatus("The active tab has no URL.", "error");
      return;
    }

    if (!isAccessiblePageUrl(tab.url)) {
      setStatus(
        "Chrome internal pages and other protected pages cannot be accessed.",
        "error"
      );
      return;
    }

    const extractedData = await extractFromTab(tab.id);
    pendingLead = normalizeExtractedData(extractedData);
    renderPreview(pendingLead);

    if (getUsefulValueCount(pendingLead) === 0) {
      setStatus("No useful lead data was found on this page.", "warning");
      return;
    }

    setStatus("Page captured. Review the values before saving.", "success");
  } catch (error) {
    console.error("Page capture failed.", error);
    setStatus(getCaptureErrorMessage(error), "error");
  } finally {
    setCaptureLoading(false);
  }
}

captureButton.addEventListener("click", captureCurrentPage);

cancelPreviewButton.addEventListener("click", () => {
  hidePreview();
  setStatus("Capture cancelled. No lead was saved.");
});

saveLeadButton.addEventListener("click", () => {
  if (!pendingLead) {
    setStatus("Capture a page before saving a lead.", "error");
    return;
  }

  setStatus(
    "Lead reviewed. Persistent saving will be connected in a later task.",
    "success"
  );
});

async function initializePopup() {
  try {
    leadCount.textContent = String(await getLeadCount());
  } catch (error) {
    console.error("Unable to read stored lead count.", error);
    setStatus("Unable to read collected leads.");
  }
}

initializePopup();
