// ── Page info & scroll helpers ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ ok: true });
  } else if (msg.type === 'get_page_info') {
    sendResponse({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      currentScrollY: window.scrollY,
    });
  } else if (msg.type === 'scroll_to') {
    window.scrollTo(0, msg.y as number);
    setTimeout(() => sendResponse({ done: true }), 200);
    return true;
  } else if (msg.type === 'start_crop') {
    injectCropHint(() => injectCropOverlay());
    sendResponse({ ok: true });
  }
});

// ── URL change detection ─────────────────────────────────────────────────────

let currentUrl = window.location.href;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const notifyUrlChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      chrome.runtime.sendMessage({ type: 'url_changed', url: currentUrl });
    }
  }, 100);
};

const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});

// ── Crop hint animation ───────────────────────────────────────────────────────

function injectCropHint(onDone: () => void) {
  const hint = document.createElement('div');
  hint.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:16px', 'background:rgba(0,0,0,0.55)', 'pointer-events:none',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:220px;height:140px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;background:rgba(255,255,255,0.05);overflow:hidden;';

  // Selection rectangle that grows
  const sel = document.createElement('div');
  sel.style.cssText = 'position:absolute;top:28px;left:30px;width:0;height:0;border:2px dashed #3b82f6;background:rgba(59,130,246,0.15);transition:none;pointer-events:none;';
  box.appendChild(sel);

  // Mouse cursor SVG
  const cur = document.createElement('div');
  cur.style.cssText = 'position:absolute;top:0;left:0;transform:translate(30px,28px);transition:none;pointer-events:none;';
  cur.innerHTML = '<svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M4 2L4 14L7.5 11L9.5 16L11.5 15.2L9.5 10.2L13.5 10.2L4 2Z" fill="white" stroke="#1d4ed8" stroke-width="1"/></svg>';
  box.appendChild(cur);

  const label = document.createElement('p');
  label.textContent = 'Drag to select an area';
  label.style.cssText = 'color:white;font-size:13px;font-family:sans-serif;font-weight:500;margin:0;';

  const sub = document.createElement('p');
  sub.textContent = 'Click to skip';
  sub.style.cssText = 'color:rgba(255,255,255,0.4);font-size:11px;font-family:sans-serif;margin:0;';

  hint.appendChild(box);
  hint.appendChild(label);
  hint.appendChild(sub);
  document.body.appendChild(hint);

  const DURATION = 2500;
  const start = performance.now();

  function animate(now: number) {
    const t = Math.min((now - start) / DURATION, 1);
    // Ease in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // Delay start of drag to 15% of animation
    const drag = Math.max(0, (t - 0.15) / 0.70);
    const dragEase = drag < 0.5 ? 4 * drag * drag * drag : 1 - Math.pow(-2 * drag + 2, 3) / 2;
    const w = Math.round(dragEase * 160);
    const h = Math.round(dragEase * 84);
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';
    const cx = 30 + w;
    const cy = 28 + h;
    cur.style.transform = `translate(${cx}px,${cy}px)`;
    // Fade out last 10%
    const opacity = t > 0.9 ? 1 - (t - 0.9) / 0.1 : 1;
    hint.style.opacity = String(opacity);
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      hint.remove();
      onDone();
    }
  }

  requestAnimationFrame(animate);

  // Click anywhere skips animation
  hint.style.pointerEvents = 'all';
  hint.addEventListener('click', () => { hint.remove(); onDone(); }, { once: true });
}

// ── Crop overlay ─────────────────────────────────────────────────────────────

let cropOverlay: HTMLDivElement | null = null;
let cropKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function removeCropOverlay() {
  cropOverlay?.remove();
  cropOverlay = null;
  if (cropKeyHandler) {
    document.removeEventListener('keydown', cropKeyHandler);
    cropKeyHandler = null;
  }
}

function injectCropOverlay() {
  if (cropOverlay) return;

  cropOverlay = document.createElement('div');
  cropOverlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.25);';

  let startX = 0;
  let startY = 0;
  let selectionEl: HTMLDivElement | null = null;

  cropOverlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    selectionEl = document.createElement('div');
    selectionEl.style.cssText =
      'position:fixed;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);pointer-events:none;';
    cropOverlay!.appendChild(selectionEl);
  });

  cropOverlay.addEventListener('mousemove', (e) => {
    if (!selectionEl) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    selectionEl.style.left = x + 'px';
    selectionEl.style.top = y + 'px';
    selectionEl.style.width = Math.abs(e.clientX - startX) + 'px';
    selectionEl.style.height = Math.abs(e.clientY - startY) + 'px';
  });

  cropOverlay.addEventListener('mouseup', (e) => {
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    removeCropOverlay();
    if (width > 10 && height > 10) {
      chrome.runtime.sendMessage({
        type: 'crop_done',
        rect: { x, y, width, height },
        dpr: window.devicePixelRatio,
      });
    }
  });

  cropKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeCropOverlay();
    }
  };
  document.addEventListener('keydown', cropKeyHandler);
  document.body.appendChild(cropOverlay);
}
