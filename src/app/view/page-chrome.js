import { APP_NAME } from '../../core/constants.js';
import { createFaviconModel, renderFaviconDataUrl } from '../../core/favicon.js';
import { formatDocumentTitle } from '../../core/format.js';
import { getRemainingMs } from '../../core/session.js';

function ensureFaviconLink() {
  let link = document.querySelector('link[rel="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }

  return link;
}

export function createPageChromeUpdater({ state }) {
  const faviconLink = ensureFaviconLink();
  let chromeSignature = '';

  function updatePageChrome(now = Date.now()) {
    const title = formatDocumentTitle(state.activeSession, now, APP_NAME);
    const faviconModel = createFaviconModel(state.activeSession, now);
    const signature = `${title}|${state.activeSession.status}|${Math.ceil(
      getRemainingMs(state.activeSession, now) / 1000
    )}`;

    document.title = title;

    if (signature !== chromeSignature) {
      chromeSignature = signature;
      faviconLink.href = renderFaviconDataUrl(faviconModel);
    }
  }

  return {
    updatePageChrome
  };
}
