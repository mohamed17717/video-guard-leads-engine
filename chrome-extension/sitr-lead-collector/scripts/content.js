(async () => {
  const extractorUrl = chrome.runtime.getURL("services/extractor.js");
  const { extractPageData } = await import(extractorUrl);

  return extractPageData(document);
})();
