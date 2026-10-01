## Privaknow Chrome Extension (Basic Detection)

This is a minimal Manifest V3 Chrome extension that detects when a user is on a page that likely contains a Terms & Conditions or Privacy Policy and shows a small popup banner on the page.

### Behavior

- **Detection**: The content script runs on all pages and looks for common Terms & Conditions / Privacy Policy keywords in:
  - the page title
  - the URL
  - a sample of the page text
- **Popup**: When a likely match is found, a banner appears in the top-right corner that says:
  - `Privaknow detected a T&C/Privacy Policy page.`
- The banner can be dismissed with the close button.

### File Overview

- `manifest.json`: Chrome extension manifest (Manifest V3).
- `src/content.js`: Content script that performs detection and injects the banner.
- `src/content.css`: Styles for the injected banner.
- `icons/`: Placeholder icons (you can add real ones).

### How to Load in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked**.
4. Select the `Privaknow - AI Summarizer` folder (this project directory).
5. Visit any Terms & Conditions or Privacy Policy page and you should see the Privaknow banner appear.

### Notes

- There is **no AI summarization yet**—this is just the detection and popup UX.
- The detection is heuristic and keyword-based and can be refined later.

