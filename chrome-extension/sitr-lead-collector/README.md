# Sitr Lead Collector

Sitr Lead Collector is a lightweight Chrome extension scaffold built with
Manifest V3, vanilla JavaScript, HTML, CSS, and Chrome Extension APIs.

The extension is designed to collect public lead information only when the user
presses **Capture This Page**. Page extraction is not run automatically.

## Current status

This version contains the project structure, tested page extraction and
normalization utilities, a review-first capture preview, and persistent lead
storage with duplicate replace/merge handling. The collected leads page supports
batched card rendering, search, copy, source opening, detail expansion, and
deletion. The popup can export the complete collection as a UTF-8 TXT file and
as pretty-printed UTF-8 JSON. Both formats offer to keep or clear stored leads
only after the download starts. Missing Phone and WhatsApp numbers can be added
manually during preview. WhatsApp numbers are also detected from embedded widget
configuration such as JoinChat `data-settings` JSON and button data attributes.
Email addresses are collected from visible content, `mailto:` links, metadata,
contact controls, `data-email` attributes, and common obfuscated formats.

## Load the extension in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** using the switch in the top-right corner.
4. Select **Load unpacked**.
5. Choose the `sitr-lead-collector` folder containing `manifest.json`.
6. Pin **Sitr Lead Collector** from the Extensions menu if you want quick access.

After editing the extension, return to `chrome://extensions` and select the
extension's reload button to apply the changes.

## Project structure

```text
sitr-lead-collector/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── leads/
│   ├── leads.html
│   ├── leads.css
│   └── leads.js
├── scripts/
│   └── content.js
├── services/
│   ├── storage.js
│   ├── extractor.js
│   ├── normalizer.js
│   └── exporter.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── tests/
│   ├── exporter.test.js
│   ├── extractor.test.js
│   ├── normalizer.test.js
│   └── storage.test.js
└── README.md
```
