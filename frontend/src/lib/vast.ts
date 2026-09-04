export type VastFill = {
  adId?: string;
  creativeId?: string;
  durationSec?: number;
  mediaUrl: string;
  mimeType: string;
  impressionUrls: string[];
  tracking: Record<string, string[]>;
  errorUrls: string[];
};

export function expandVastMacros(
  rawUrl: string,
  opts: { screenId?: string; width?: number; height?: number; lat?: number; lon?: number }
) {
  const correlator = Date.now().toString();
  const cacheBuster = Math.random().toString(36).slice(2);
  let url = rawUrl
    .replace(/\[CACHEBUSTING\]/gi, cacheBuster)
    .replace(/\[TIMESTAMP\]/gi, correlator)
    .replace(/\[SCREEN_ID\]/gi, opts.screenId || '')
    .replace(/\[WIDTH\]/gi, String(opts.width || 1920))
    .replace(/\[HEIGHT\]/gi, String(opts.height || 1080))
    .replace(/\[LAT\]/gi, opts.lat != null ? String(opts.lat) : '')
    .replace(/\[LON\]/gi, opts.lon != null ? String(opts.lon) : '')
    .replace(/\[APP_BUNDLE\]/gi, 'smartags-web-player');

  if (/correlator=/i.test(url)) {
    url = url.replace(/correlator=[^&]*/i, `correlator=${correlator}`);
  } else {
    url += (url.includes('?') ? '&' : '?') + `correlator=${correlator}`;
  }
  return url;
}

function textContent(el: Element | null) {
  return (el?.textContent || '').trim();
}

function parseDuration(raw: string): number | undefined {
  const parts = raw.trim().split(':');
  try {
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parseInt(parts[2].split('.')[0], 10);
      return h * 3600 + m * 60 + s;
    }
    const n = parseFloat(parts[0]);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchVastFill(vastUrl: string, timeoutMs = 3000, depth = 0): Promise<VastFill | null> {
  if (depth > 5) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(vastUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    const wrapper = textContent(doc.querySelector('VASTAdTagURI'));
    const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
    if (wrapper && mediaFiles.length === 0) {
      return fetchVastFill(wrapper, timeoutMs, depth + 1);
    }

    const candidates = mediaFiles
      .map((mf) => ({
        url: textContent(mf),
        mime: mf.getAttribute('type') || 'video/mp4',
        width: parseInt(mf.getAttribute('width') || '0', 10) || 0,
      }))
      .filter((c) => !!c.url);

    const best =
      candidates.filter((c) => /mp4|video\//i.test(c.mime)).sort((a, b) => b.width - a.width)[0] ||
      candidates[0];
    if (!best) return null;

    const tracking: Record<string, string[]> = {};
    doc.querySelectorAll('Tracking').forEach((t) => {
      const ev = t.getAttribute('event') || 'unknown';
      const url = textContent(t);
      if (!url) return;
      tracking[ev] = tracking[ev] || [];
      tracking[ev].push(url);
    });

    return {
      adId: doc.querySelector('Ad')?.getAttribute('id') || undefined,
      creativeId: doc.querySelector('Creative')?.getAttribute('id') || undefined,
      durationSec: parseDuration(textContent(doc.querySelector('Duration')) || ''),
      mediaUrl: best.url,
      mimeType: best.mime,
      impressionUrls: Array.from(doc.querySelectorAll('Impression')).map(textContent).filter(Boolean),
      tracking,
      errorUrls: Array.from(doc.querySelectorAll('Error')).map(textContent).filter(Boolean),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function fireTrackingUrls(urls: string[]) {
  urls.forEach((url) => {
    try {
      const img = new Image();
      img.src = url;
    } catch {
      // ignore
    }
  });
}
