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
    const lang = (msg.lang as string) ?? 'en';
    chrome.storage.local.get('partsiq_skip_crop_hint', (result) => {
      if (result.partsiq_skip_crop_hint) {
        injectCropOverlay();
      } else {
        injectCropHint(lang, () => injectCropOverlay());
      }
    });
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
      chrome.runtime.sendMessage({ type: 'url_changed', url: currentUrl }).catch(() => {});
    }
  }, 100);
};

const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href }).catch(() => {});
    return result;
  };
});

// ── Crop hint animation ───────────────────────────────────────────────────────

function createCursorSvg(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M4 2L4 14L7.5 11L9.5 16L11.5 15.2L9.5 10.2L13.5 10.2L4 2Z');
  path.setAttribute('fill', 'white');
  path.setAttribute('stroke', '#1d4ed8');
  path.setAttribute('stroke-width', '1');
  svg.appendChild(path);
  return svg;
}

function injectCropHint(lang: string, onDone: () => void) {
  const isNl = lang === 'nl';

  const hint = document.createElement('div');
  hint.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
    'gap:16px', 'background:rgba(0,0,0,0.55)', 'pointer-events:all',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:220px;height:140px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;background:rgba(255,255,255,0.05);overflow:hidden;';

  const sel = document.createElement('div');
  sel.style.cssText = 'position:absolute;top:28px;left:30px;width:0;height:0;border:2px dashed #3b82f6;background:rgba(59,130,246,0.15);pointer-events:none;';
  box.appendChild(sel);

  const cur = document.createElement('div');
  cur.style.cssText = 'position:absolute;top:0;left:0;transform:translate(30px,28px);pointer-events:none;';
  cur.appendChild(createCursorSvg());
  box.appendChild(cur);

  const label = document.createElement('p');
  label.textContent = isNl ? 'Sleep om een gebied te selecteren' : 'Drag to select an area';
  label.style.cssText = 'color:white;font-size:13px;font-family:sans-serif;font-weight:500;margin:0;';

  const checkRow = document.createElement('label');
  checkRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.style.cssText = 'width:14px;height:14px;accent-color:#00C6B2;cursor:pointer;';

  const checkLabel = document.createElement('span');
  checkLabel.textContent = isNl ? 'Niet meer tonen' : "Don't show again";
  checkLabel.style.cssText = 'color:rgba(255,255,255,0.7);font-size:12px;font-family:sans-serif;';

  checkRow.appendChild(checkbox);
  checkRow.appendChild(checkLabel);

  const btn = document.createElement('button');
  btn.textContent = isNl ? 'Begrepen!' : 'Got it!';
  btn.style.cssText = [
    'padding:8px 24px', 'border:none', 'border-radius:9999px',
    'background:#00C6B2', 'color:#473150', 'font-size:13px',
    'font-family:sans-serif', 'font-weight:600', 'cursor:pointer',
  ].join(';');

  hint.appendChild(box);
  hint.appendChild(label);
  hint.appendChild(checkRow);
  hint.appendChild(btn);
  document.body.appendChild(hint);

  const DURATION = 2500;
  const start = performance.now();
  let dismissed = false;

  function animate(now: number) {
    if (dismissed) return;
    const t = Math.min((now - start) / DURATION, 1);
    const drag = Math.max(0, (t - 0.15) / 0.70);
    const dragEase = drag < 0.5 ? 4 * drag * drag * drag : 1 - Math.pow(-2 * drag + 2, 3) / 2;
    const w = Math.round(dragEase * 160);
    const h = Math.round(dragEase * 84);
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';
    cur.style.transform = `translate(${30 + w}px,${28 + h}px)`;
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // "Got it!" dismisses the hint then shows the cropper after a short
  // delay so the mouseup/click doesn't leak into the crop overlay.
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    hint.remove();
    setTimeout(onDone, 50);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (checkbox.checked) {
      chrome.storage.local.set({ partsiq_skip_crop_hint: true });
    }
    dismiss();
  }, { once: true });
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
      chrome.runtime.sendMessage({ type: 'crop_ready', error: 'Cancelled by user' }).catch(() => {});
    }
  };
  document.addEventListener('keydown', cropKeyHandler);
  document.body.appendChild(cropOverlay);
}
