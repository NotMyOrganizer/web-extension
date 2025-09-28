# Browser Inspector - Quick install & notes

1. Put the folder `browser-inspector/` on your disk containing the files above.
2. Open Chrome -> Menu -> More Tools -> Extensions.
3. Enable "Developer mode" (top-right).
4. Click "Load unpacked" and select the `browser-inspector/` folder.
5. The extension icon will appear. Click it to open the popup.

Permissions:
- The extension requests `history` permission to read browser history.
- Host permission `<all_urls>` allows fetching `robots.txt` and cross-origin content from the background.
- Geolocation is requested at runtime by the popup; users must accept the prompt.

Privacy & security:
- This extension accesses history and page metadata; only install trusted code and be mindful when sharing the extension or its outputs.
