function extractMetadata() {
  const metadata = {};

  try {
    const u = new URL(window.location.href);
    metadata.href = u.href;
    metadata.protocol = u.protocol;
    metadata.hostname = u.hostname;
    metadata.port = u.port;
    metadata.pathname = u.pathname;
    metadata.search = u.search;
    metadata.searchParams = {};
    for (const [k, v] of u.searchParams.entries()) {
      if (metadata.searchParams[k] === undefined) metadata.searchParams[k] = v;
      else if (Array.isArray(metadata.searchParams[k])) metadata.searchParams[k].push(v);
      else metadata.searchParams[k] = [metadata.searchParams[k], v];
    }
    metadata.hash = u.hash;
  } catch (err) {
    metadata.urlError = err.message;
  }

  metadata.title = document.title || "";

  const canonicalEl = document.querySelector("link[rel='canonical']");
  metadata.canonical = canonicalEl ? canonicalEl.href : null;

  const meta = {};
  const metaEls = document.getElementsByTagName("meta");
  for (let i = 0; i < metaEls.length; i++) {
    const el = metaEls[i];
    if (el.name) {
      meta[el.name.toLowerCase()] = el.content || "";
    }
    if (el.getAttribute("property")) {
      meta[el.getAttribute("property").toLowerCase()] = el.content || "";
    }
  }
  metadata.meta = meta;

  metadata.links = Array.from(document.querySelectorAll("link")).map(l => ({
    rel: l.rel,
    href: l.href,
    type: l.type || null
  }));

  metadata.numImages = document.images ? document.images.length : 0;
  metadata.numLinks = document.links ? document.links.length : 0;

  return metadata;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_METADATA") {
    sendResponse({ ok: true, data: extractMetadata() });
  }
  return true;
});