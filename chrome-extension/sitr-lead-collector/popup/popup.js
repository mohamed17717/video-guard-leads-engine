import { getLeadCount } from "../services/storage.js";

const statusMessage = document.querySelector("#status-message");
const leadCount = document.querySelector("#lead-count");

const placeholderActions = {
  "#capture-page": "Page capture will be added in a later task.",
  "#view-leads": "The collected leads view will be added in a later task.",
  "#export-txt": "TXT export will be added in a later task.",
  "#export-json": "JSON export will be added in a later task.",
  "#clear-all": "Clearing collected leads will be added in a later task."
};

function setStatus(message) {
  statusMessage.textContent = message;
}

for (const [selector, message] of Object.entries(placeholderActions)) {
  document.querySelector(selector).addEventListener("click", () => {
    setStatus(message);
  });
}

async function initializePopup() {
  try {
    leadCount.textContent = String(await getLeadCount());
  } catch (error) {
    console.error("Unable to read stored lead count.", error);
    setStatus("Unable to read collected leads.");
  }
}

initializePopup();
