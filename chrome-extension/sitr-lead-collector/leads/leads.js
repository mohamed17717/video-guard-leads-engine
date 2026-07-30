import {
  copyTextToClipboard,
  formatExternalLinksForCopy,
  formatLeadsForCopy,
  formatPhoneNumbersForCopy,
  formatSocialLinksForCopy
} from "../services/clipboard.js";
import {
  deleteLead,
  getAllLeads,
  STORAGE_KEY
} from "../services/storage.js";

const BATCH_SIZE = 50;

const cardsContainer = document.querySelector("#lead-cards");
const emptyState = document.querySelector("#empty-state");
const emptyMessage = document.querySelector("#empty-message");
const loadMoreButton = document.querySelector("#load-more");
const resultsMeta = document.querySelector("#results-meta");
const searchInput = document.querySelector("#lead-search");
const clearSearchButton = document.querySelector("#clear-search");
const statusMessage = document.querySelector("#viewer-status");
const copyAllLeadsButton = document.querySelector("#copy-all-leads");

let allLeads = [];
let filteredLeads = [];
let leadById = new Map();
let visibleLimit = BATCH_SIZE;
let searchTimer = null;
let detailIdCounter = 0;

function setStatus(message = "", state = "neutral") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function getPhoneText(phone) {
  if (phone && typeof phone === "object") {
    return [
      phone.raw,
      phone.normalized,
      phone.source,
      phone.context
    ].filter(Boolean).join(" ");
  }

  return String(phone ?? "");
}

function getSocialText(link) {
  if (link && typeof link === "object") {
    return [link.platform, link.url].filter(Boolean).join(" ");
  }

  return String(link ?? "");
}

function getExternalLinkText(link) {
  if (link && typeof link === "object") {
    return [link.text, link.url, link.type].filter(Boolean).join(" ");
  }

  return String(link ?? "");
}

function createSearchText(lead) {
  return [
    lead.pageTitle,
    lead.sourceUrl,
    ...(lead.phones ?? []).map(getPhoneText),
    ...(lead.whatsapp ?? []).map(getPhoneText),
    ...(lead.emails ?? []),
    ...(lead.socialLinks ?? []).map(getSocialText),
    ...(lead.externalLinks ?? []).map(getExternalLinkText)
  ]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase();
}

function capturedTime(lead) {
  const value = Date.parse(lead.capturedAt);
  return Number.isFinite(value) ? value : 0;
}

function setSummaryValue(valueId, labelId, value, singular, plural) {
  document.querySelector(valueId).textContent = String(value);
  document.querySelector(labelId).textContent =
    value === 1 ? singular : plural;
}

function renderSummary() {
  const phoneCount = allLeads.reduce(
    (total, lead) => total + (lead.phones?.length ?? 0),
    0
  );
  const whatsappCount = allLeads.reduce(
    (total, lead) => total + (lead.whatsapp?.length ?? 0),
    0
  );
  const emailCount = allLeads.reduce(
    (total, lead) => total + (lead.emails?.length ?? 0),
    0
  );
  const socialCount = allLeads.reduce(
    (total, lead) => total + (lead.socialLinks?.length ?? 0),
    0
  );

  setSummaryValue(
    "#total-leads",
    "#total-leads-label",
    allLeads.length,
    "Lead",
    "Leads"
  );
  setSummaryValue(
    "#total-phones",
    "#total-phones-label",
    phoneCount,
    "Phone Number",
    "Phone Numbers"
  );
  setSummaryValue(
    "#total-whatsapp",
    "#total-whatsapp-label",
    whatsappCount,
    "WhatsApp Number",
    "WhatsApp Numbers"
  );
  setSummaryValue(
    "#total-emails",
    "#total-emails-label",
    emailCount,
    "Email Address",
    "Email Addresses"
  );
  setSummaryValue(
    "#total-social",
    "#total-social-label",
    socialCount,
    "Social Link",
    "Social Links"
  );
  copyAllLeadsButton.disabled = allLeads.length === 0;
}

function formatCapturedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value ?? "") || "Unknown capture time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function createActionButton(label, action, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-button ${extraClass}`.trim();
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createCountChip(label, count) {
  const chip = document.createElement("span");
  chip.className = "count-chip";
  chip.textContent = `${count} ${label}`;
  return chip;
}

function createLeadCard(lead) {
  const card = document.createElement("article");
  const top = document.createElement("div");
  const identity = document.createElement("div");
  const actions = document.createElement("div");
  const title = document.createElement("h3");
  const source = document.createElement("a");
  const captured = document.createElement("p");
  const counts = document.createElement("div");
  const details = document.createElement("div");
  const detailsId = `lead-details-${detailIdCounter++}`;

  card.className = "lead-card";
  card.dataset.leadId = lead.id;
  top.className = "lead-card__top";
  title.className = "lead-card__title";
  title.textContent = lead.pageTitle || lead.hostname || "Untitled page";
  source.className = "lead-card__source";
  source.textContent = lead.sourceUrl || "No source URL";
  source.title = lead.sourceUrl || "";

  if (isWebUrl(lead.sourceUrl)) {
    source.href = lead.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
  }

  captured.className = "lead-card__captured";
  captured.textContent = `Captured ${formatCapturedAt(lead.capturedAt)}`;

  identity.append(title, source, captured);

  actions.className = "lead-card__actions";
  const openButton = createActionButton("Open Source", "open");
  openButton.disabled = !isWebUrl(lead.sourceUrl);
  const copyPhonesButton = createActionButton(
    "Copy Phones",
    "copy-phones"
  );
  copyPhonesButton.disabled = !lead.phones?.length;
  const copyWhatsappButton = createActionButton(
    "Copy WhatsApp",
    "copy-whatsapp"
  );
  copyWhatsappButton.disabled = !lead.whatsapp?.length;
  const copySocialButton = createActionButton(
    "Copy Social Links",
    "copy-social"
  );
  copySocialButton.disabled = !lead.socialLinks?.length;
  const copyExternalButton = createActionButton(
    "Copy External Links",
    "copy-external"
  );
  copyExternalButton.disabled = !lead.externalLinks?.length;
  const copyLeadButton = createActionButton(
    "Copy Complete Lead",
    "copy-lead"
  );
  const deleteButton = createActionButton(
    "Delete",
    "delete",
    "action-button--danger"
  );
  const expandButton = createActionButton("Expand Details", "toggle");
  expandButton.setAttribute("aria-expanded", "false");
  expandButton.setAttribute("aria-controls", detailsId);
  actions.append(
    openButton,
    copyPhonesButton,
    copyWhatsappButton,
    copySocialButton,
    copyExternalButton,
    copyLeadButton,
    deleteButton,
    expandButton
  );

  top.append(identity, actions);

  counts.className = "lead-card__counts";
  counts.append(
    createCountChip("phones", lead.phones?.length ?? 0),
    createCountChip("WhatsApp", lead.whatsapp?.length ?? 0),
    createCountChip("emails", lead.emails?.length ?? 0),
    createCountChip("social", lead.socialLinks?.length ?? 0),
    createCountChip("external", lead.externalLinks?.length ?? 0)
  );

  details.id = detailsId;
  details.className = "lead-card__details";
  details.dataset.rendered = "false";
  details.hidden = true;

  card.append(top, counts, details);
  return card;
}

function isWebUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function formatPhone(phone) {
  if (phone && typeof phone === "object") {
    const raw = String(phone.raw ?? "").trim();
    const normalized = String(phone.normalized ?? "").trim();
    const number = raw && normalized && raw !== normalized
      ? `${raw} → ${normalized}`
      : normalized || raw;
    const details = [phone.source, phone.context].filter(Boolean).join(" — ");

    return details ? `${number} — ${details}` : number;
  }

  return String(phone ?? "");
}

function createDetailSection(title, values, formatter, links = false) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const cleanValues = (values ?? []).filter(Boolean);

  section.className = "detail-section";
  heading.textContent = title;
  section.append(heading);

  if (!cleanValues.length) {
    const empty = document.createElement("p");
    empty.className = "detail-section__empty";
    empty.textContent = "None found";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");

  for (const value of cleanValues) {
    const item = document.createElement("li");
    const label = formatter(value);

    if (links) {
      const url = typeof value === "string" ? value : value.url;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = label;
      item.append(anchor);
    } else {
      item.textContent = label;
    }

    list.append(item);
  }

  section.append(list);
  return section;
}

function renderLeadDetails(container, lead) {
  if (container.dataset.rendered === "true") {
    return;
  }

  container.append(
    createDetailSection("Phones", lead.phones, formatPhone),
    createDetailSection("WhatsApp", lead.whatsapp, formatPhone),
    createDetailSection("Emails", lead.emails, (email) => email),
    createDetailSection(
      "Social Links",
      lead.socialLinks,
      (link) => `${link.platform}: ${link.url}`,
      true
    ),
    createDetailSection(
      "External Links",
      lead.externalLinks,
      (link) =>
        typeof link === "string"
          ? link
          : link.text
            ? `${link.text}: ${link.url}`
            : link.url,
      true
    )
  );
  container.dataset.rendered = "true";
}

function renderCards() {
  const visibleLeads = filteredLeads.slice(0, visibleLimit);
  const fragment = document.createDocumentFragment();

  for (const lead of visibleLeads) {
    fragment.append(createLeadCard(lead));
  }

  cardsContainer.replaceChildren(fragment);

  const hasResults = filteredLeads.length > 0;
  cardsContainer.hidden = !hasResults;
  emptyState.hidden = hasResults;
  emptyMessage.textContent = allLeads.length
    ? "No saved lead matches your search."
    : "Capture a page to start your lead collection.";
  resultsMeta.textContent = hasResults
    ? `Showing ${visibleLeads.length} of ${filteredLeads.length} leads`
    : "0 leads";
  loadMoreButton.hidden = visibleLeads.length >= filteredLeads.length;
}

function applySearch() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  visibleLimit = BATCH_SIZE;
  filteredLeads = terms.length
    ? allLeads.filter((lead) => {
        const searchText = createSearchText(lead);
        return terms.every((term) => searchText.includes(term));
      })
    : [...allLeads];

  clearSearchButton.hidden = !query;
  renderCards();
}

async function loadLeads() {
  try {
    const leads = await getAllLeads();
    allLeads = [...leads].sort((a, b) => capturedTime(b) - capturedTime(a));
    leadById = new Map(allLeads.map((lead) => [lead.id, lead]));
    renderSummary();
    applySearch();
  } catch (error) {
    console.error("Unable to load collected leads.", error);
    allLeads = [];
    filteredLeads = [];
    leadById = new Map();
    renderSummary();
    renderCards();
    setStatus("Collected leads could not be loaded.", "error");
  }
}

async function handleDelete(lead, button) {
  const title = lead.pageTitle || lead.hostname || "this lead";
  const confirmed = window.confirm(`Delete "${title}"?`);

  if (!confirmed) {
    setStatus("Delete cancelled.");
    return;
  }

  button.disabled = true;

  try {
    const deleted = await deleteLead(lead.id);

    if (!deleted) {
      setStatus("This lead no longer exists.", "error");
      await loadLeads();
      return;
    }

    await loadLeads();
    setStatus("Lead deleted.", "success");
  } catch (error) {
    console.error("Unable to delete lead.", error);
    button.disabled = false;
    setStatus("The lead could not be deleted.", "error");
  }
}

const LEAD_COPY_ACTIONS = {
  "copy-phones": {
    getText: (lead) => formatPhoneNumbersForCopy(lead.phones),
    emptyMessage: "There are no phone numbers to copy."
  },
  "copy-whatsapp": {
    getText: (lead) => formatPhoneNumbersForCopy(lead.whatsapp),
    emptyMessage: "There are no WhatsApp numbers to copy."
  },
  "copy-social": {
    getText: (lead) => formatSocialLinksForCopy(lead.socialLinks),
    emptyMessage: "There are no social links to copy."
  },
  "copy-external": {
    getText: (lead) => formatExternalLinksForCopy(lead.externalLinks),
    emptyMessage: "There are no external links to copy."
  },
  "copy-lead": {
    getText: (lead) => formatLeadsForCopy([lead]),
    emptyMessage: "There is no lead to copy."
  }
};

async function handleLeadCopy(lead, action) {
  const copyAction = LEAD_COPY_ACTIONS[action];
  const text = copyAction.getText(lead);

  if (!text) {
    setStatus(copyAction.emptyMessage);
    return;
  }

  try {
    await copyTextToClipboard(text);
    setStatus("Copied successfully", "success");
  } catch (error) {
    console.error("Unable to copy lead data.", error);
    setStatus("The selected data could not be copied.", "error");
  }
}

cardsContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const card = button.closest(".lead-card");
  const lead = leadById.get(card?.dataset.leadId);

  if (!lead) {
    setStatus("This lead is no longer available.", "error");
    return;
  }

  if (button.dataset.action === "open") {
    try {
      await chrome.tabs.create({ url: lead.sourceUrl });
    } catch (error) {
      console.error("Unable to open source page.", error);
      setStatus("The source page could not be opened.", "error");
    }
    return;
  }

  if (LEAD_COPY_ACTIONS[button.dataset.action]) {
    await handleLeadCopy(lead, button.dataset.action);
    return;
  }

  if (button.dataset.action === "delete") {
    await handleDelete(lead, button);
    return;
  }

  if (button.dataset.action === "toggle") {
    const details = card.querySelector(".lead-card__details");
    const willExpand = details.hidden;

    if (willExpand) {
      renderLeadDetails(details, lead);
    }

    details.hidden = !willExpand;
    button.textContent = willExpand ? "Collapse Details" : "Expand Details";
    button.setAttribute("aria-expanded", String(willExpand));
  }
});

copyAllLeadsButton.addEventListener("click", async () => {
  if (!allLeads.length) {
    setStatus("There are no saved leads to copy.");
    return;
  }

  copyAllLeadsButton.disabled = true;

  try {
    await copyTextToClipboard(formatLeadsForCopy(allLeads));
    setStatus("Copied successfully", "success");
  } catch (error) {
    console.error("Unable to copy all leads.", error);
    setStatus("The leads could not be copied.", "error");
  } finally {
    copyAllLeadsButton.disabled = allLeads.length === 0;
  }
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(applySearch, 120);
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  applySearch();
});

loadMoreButton.addEventListener("click", () => {
  visibleLimit += BATCH_SIZE;
  renderCards();
});

if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      loadLeads();
    }
  });
}

loadLeads();
