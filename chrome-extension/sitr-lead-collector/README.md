# Sitr Lead Collector

Sitr Lead Collector is a lightweight Chrome extension scaffold built with
Manifest V3, vanilla JavaScript, HTML, CSS, and Chrome Extension APIs.

The extension is designed to collect public lead information only when the user
presses **Capture This Page**. Page extraction is not run automatically.

## Current status

This version contains the project structure, popup interface, tested page
extraction utilities, and tested phone and URL normalization. Connecting
extraction to the popup, lead viewing, export, storage, and clearing behavior
remain placeholders for later tasks.

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
│   ├── extractor.test.js
│   └── normalizer.test.js
└── README.md
```
