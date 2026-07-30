import {
  addLead,
  clearAllLeads,
  getAllLeads,
  getLeadCount,
  STORAGE_KEY
} from "../services/storage.js";
import {
  downloadLeadCollectionAsCsv,
  downloadLeadCollectionAsJson,
  downloadLeadCollectionAsTxt
} from "../services/exporter.js";
import { extractPhonesFromText } from "../services/extractor.js";
import {
  normalizeExtractedData,
  normalizePhoneNumber
} from "../services/normalizer.js";

const statusMessage = document.querySelector("#status-message");
const leadCount = document.querySelector("#lead-count");
const captureButton = document.querySelector("#capture-page");
const preview = document.querySelector("#lead-preview");
const saveLeadButton = document.querySelector("#save-lead");
const cancelPreviewButton = document.querySelector("#cancel-preview");
const duplicateWarning = document.querySelector("#duplicate-warning");
const replaceLeadButton = document.querySelector("#replace-lead");
const mergeLeadButton = document.querySelector("#merge-lead");
const cancelDuplicateButton = document.querySelector("#cancel-duplicate");
const clearAllButton = document.querySelector("#clear-all");
const exportTxtButton = document.querySelector("#export-txt");
const exportJsonButton = document.querySelector("#export-json");
const exportCsvButton = document.querySelector("#export-csv");
const exportDialog = document.querySelector("#export-complete-dialog");
const exportDialogTitle = document.querySelector("#export-dialog-title");
const clearAfterExportButton = document.querySelector(
  "#clear-after-export"
);
const keepAfterExportButton = document.querySelector(
  "#keep-after-export"
);
const manualPhoneInput = document.querySelector("#manual-phone");
const manualWhatsappInput = document.querySelector("#manual-whatsapp");
const addManualPhoneButton = document.querySelector("#add-manual-phone");
const addManualWhatsappButton = document.querySelector(
  "#add-manual-whatsapp"
);

let pendingLead = null;
let storageOperationPending = false;
let completedExportLabel = "File";

function setStatus(message, state = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
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
    const number =
      phone.raw && phone.raw !== phone.normalized
        ? `${phone.raw} → ${phone.normalized}`
        : phone.normalized;
    const details = [phone.source, phone.context].filter(Boolean).join(" — ");
    item.textContent = details ? `${number}\n${details}` : number;
    list.append(item);
  }
}

function renderValueList(selector, values) {
  const list = document.querySelector(selector);
  clearList(list);

  if (!values.length) {
    appendEmptyValue(list);
    return;
  }

  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
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
    lead.emails.length +
    lead.socialLinks.length +
    lead.externalLinks.length
  );
}

function updateSaveButton() {
  saveLeadButton.disabled =
    storageOperationPending ||
    !pendingLead ||
    getUsefulValueCount(pendingLead) === 0 ||
    !duplicateWarning.hidden;
}

function hideDuplicateWarning() {
  duplicateWarning.hidden = true;
  updateSaveButton();
}

function showDuplicateWarning() {
  duplicateWarning.hidden = false;
  updateSaveButton();
}

function setStorageLoading(isLoading) {
  storageOperationPending = isLoading;
  replaceLeadButton.disabled = isLoading;
  mergeLeadButton.disabled = isLoading;
  cancelDuplicateButton.disabled = isLoading;
  clearAllButton.disabled = isLoading;
  exportTxtButton.disabled = isLoading;
  exportJsonButton.disabled = isLoading;
  exportCsvButton.disabled = isLoading;
  manualPhoneInput.disabled = isLoading;
  manualWhatsappInput.disabled = isLoading;
  addManualPhoneButton.disabled = isLoading;
  addManualWhatsappButton.disabled = isLoading;
  updateSaveButton();
}

function renderPreview(lead) {
  hideDuplicateWarning();
  document.querySelector("#preview-page").textContent =
    lead.pageTitle || lead.hostname || "Untitled page";

  setCount("#preview-phone-count", lead.phones.length);
  setCount("#preview-whatsapp-count", lead.whatsapp.length);
  setCount("#preview-email-count", lead.emails.length);
  setCount("#preview-social-count", lead.socialLinks.length);
  setCount("#preview-external-count", lead.externalLinks.length);
  setCount("#phone-section-count", lead.phones.length);
  setCount("#whatsapp-section-count", lead.whatsapp.length);
  setCount("#email-section-count", lead.emails.length);
  setCount("#social-section-count", lead.socialLinks.length);
  setCount("#external-section-count", lead.externalLinks.length);

  renderPhoneList("#preview-phones", lead.phones);
  renderPhoneList("#preview-whatsapp", lead.whatsapp);
  renderValueList("#preview-emails", lead.emails);
  renderLinkList(
    "#preview-social",
    lead.socialLinks,
    ({ platform, url }) => `${platform}: ${url}`
  );
  renderLinkList("#preview-external", lead.externalLinks, (link) => {
    if (typeof link === "string") {
      return link;
    }

    return link.text ? `${link.text}: ${link.url}` : link.url;
  });

  preview.hidden = false;
  updateSaveButton();
}

function hidePreview() {
  pendingLead = null;
  preview.hidden = true;
  manualPhoneInput.value = "";
  manualWhatsappInput.value = "";
  hideDuplicateWarning();
}

function addManualNumber(field, input, label) {
  if (!pendingLead) {
    setStatus("Capture a page before adding a number.", "error");
    return;
  }

  const rawValue = input.value.trim();
  const matches = extractPhonesFromText(rawValue, { explicit: true });

  if (matches.length !== 1) {
    setStatus(
      `Enter one valid ${label.toLowerCase()} number. Dates are not accepted.`,
      "error"
    );
    input.focus();
    return;
  }

  const phone = normalizePhoneNumber(matches[0]);
  const isDuplicate = pendingLead[field].some(
    (storedPhone) => storedPhone.normalized === phone.normalized
  );

  if (isDuplicate) {
    setStatus(`That ${label.toLowerCase()} number is already in the preview.`, "warning");
    input.focus();
    return;
  }

  pendingLead[field] = [...pendingLead[field], phone];
  input.value = "";
  renderPreview(pendingLead);
  input.focus();
  setStatus(`${label} number added to the preview.`, "success");
}

addManualPhoneButton.addEventListener("click", () => {
  addManualNumber("phones", manualPhoneInput, "Phone");
});

addManualWhatsappButton.addEventListener("click", () => {
  addManualNumber("whatsapp", manualWhatsappInput, "WhatsApp");
});

manualPhoneInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addManualNumber("phones", manualPhoneInput, "Phone");
  }
});

manualWhatsappInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addManualNumber("whatsapp", manualWhatsappInput, "WhatsApp");
  }
});

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

document.querySelector("#view-leads").addEventListener("click", async () => {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("leads/leads.html")
    });
    window.close();
  } catch (error) {
    console.error("Unable to open collected leads.", error);
    setStatus("The collected leads view could not be opened.", "error");
  }
});

cancelPreviewButton.addEventListener("click", () => {
  hidePreview();
  setStatus("Capture cancelled. No lead was saved.");
});

async function refreshLeadCount() {
  leadCount.textContent = String(await getLeadCount());
}

async function storePendingLead(onDuplicate = "reject") {
  if (!pendingLead) {
    setStatus("Capture a page before saving a lead.", "error");
    return;
  }

  setStorageLoading(true);
  setStatus("Saving lead…");

  try {
    const result = await addLead(pendingLead, { onDuplicate });
    await refreshLeadCount();

    if (result.status === "duplicate") {
      showDuplicateWarning();
      setStatus(
        "This page was captured before. Replace it, merge it, or cancel.",
        "warning"
      );
      return;
    }

    const successMessage = {
      added: "Lead saved.",
      replaced: "The previous lead was replaced.",
      merged: "The new values were merged into the existing lead."
    }[result.status];

    hidePreview();
    setStatus(successMessage ?? "Lead saved.", "success");
  } catch (error) {
    console.error("Unable to save lead.", error);
    setStatus("The lead could not be saved. Please try again.", "error");
  } finally {
    setStorageLoading(false);
  }
}

saveLeadButton.addEventListener("click", () => {
  storePendingLead();
});

replaceLeadButton.addEventListener("click", () => {
  storePendingLead("replace");
});

mergeLeadButton.addEventListener("click", () => {
  storePendingLead("merge");
});

cancelDuplicateButton.addEventListener("click", () => {
  hideDuplicateWarning();
  setStatus("Duplicate save cancelled. The preview is still available.");
});

clearAllButton.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Clear every saved lead? This action cannot be undone."
  );

  if (!confirmed) {
    setStatus("Clear cancelled. No leads were removed.");
    return;
  }

  setStorageLoading(true);

  try {
    await clearAllLeads();
    await refreshLeadCount();
    hideDuplicateWarning();
    setStatus("All saved leads were cleared.", "success");
  } catch (error) {
    console.error("Unable to clear leads.", error);
    setStatus("Saved leads could not be cleared.", "error");
  } finally {
    setStorageLoading(false);
  }
});

async function exportStoredLeads(label, downloadExport) {
  setStorageLoading(true);
  setStatus(`Preparing ${label} export…`);

  try {
    const leads = await getAllLeads();

    if (!leads.length) {
      setStatus("There are no stored leads to export.", "warning");
      return;
    }

    await downloadExport(leads);
    completedExportLabel = label;
    exportDialogTitle.textContent = `${label} export started`;
    setStatus(`${label} download started successfully.`, "success");
    exportDialog.showModal();
  } catch (error) {
    console.error(`Unable to export leads as ${label}.`, error);
    setStatus(`The ${label} file could not be downloaded.`, "error");
  } finally {
    setStorageLoading(false);
  }
}

exportTxtButton.addEventListener("click", () => {
  exportStoredLeads("TXT", downloadLeadCollectionAsTxt);
});

exportJsonButton.addEventListener("click", () => {
  exportStoredLeads("JSON", downloadLeadCollectionAsJson);
});

exportCsvButton.addEventListener("click", () => {
  exportStoredLeads("CSV", downloadLeadCollectionAsCsv);
});

keepAfterExportButton.addEventListener("click", () => {
  exportDialog.close();
  setStatus(
    `${completedExportLabel} downloaded. Stored leads were kept.`,
    "success"
  );
});

clearAfterExportButton.addEventListener("click", async () => {
  clearAfterExportButton.disabled = true;
  keepAfterExportButton.disabled = true;

  try {
    await clearAllLeads();
    await refreshLeadCount();
    hideDuplicateWarning();
    exportDialog.close();
    setStatus(
      `${completedExportLabel} downloaded and stored leads were cleared.`,
      "success"
    );
  } catch (error) {
    console.error("Unable to clear leads after export.", error);
    exportDialog.close();
    setStatus(
      `${completedExportLabel} downloaded, but the stored leads could not be cleared.`,
      "error"
    );
  } finally {
    clearAfterExportButton.disabled = false;
    keepAfterExportButton.disabled = false;
  }
});

exportDialog.addEventListener("cancel", () => {
  setStatus(
    `${completedExportLabel} downloaded. Stored leads were kept.`,
    "success"
  );
});

if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    const leads = changes[STORAGE_KEY].newValue;
    leadCount.textContent = String(Array.isArray(leads) ? leads.length : 0);
  });
}

async function initializePopup() {
  try {
    await refreshLeadCount();
  } catch (error) {
    console.error("Unable to read stored lead count.", error);
    setStatus("Unable to read collected leads.");
  }
}

initializePopup();
