const STORAGE_KEY = "collectedLeads";

export async function getLeadCount() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const leads = result[STORAGE_KEY];

  return Array.isArray(leads) ? leads.length : 0;
}
