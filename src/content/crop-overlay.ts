interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

let overlayEl: HTMLDivElement | null = null;

export function showCropOverlay(): void {
  if (overlayEl) return;

  // ── Inject styles ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'partsiq-crop-styles';
  style.textContent = `
    #partsiq-crop-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.45);
      z-index: 2147483647;
      cursor: crosshair;
      user-select: none;
    }
    #partsiq-crop-selection {
      display: none;
      position: fixed;
      border: 2px solid #00C6B2;
      background: rgba(0,198,178,0.08);
      pointer-events: none;
    }
    #partsiq-crop-hint {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: piq-hint-fade 2.5s ease forwards;
    }
    .piq-cursor {
      position: absolute;
      top: 0; left: 0;
      animation: piq-cursor-move 2.5s ease forwards;
    }
    .piq-hint-box {
      position: absolute;
      top: 20px; left: 20px;
      border: 2px dashed #00C6B2;
      border-radius: 2px;
      animation: piq-box-grow 2.5s ease forwards;
    }
    @keyframes piq-hint-fade {
      0%   { opacity: 0; }
      10%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes piq-cursor-move {
      0%   { transform: translate(0,0) scale(1); }
      20%  { transform: translate(0,0) scale(0.85); }
      30%  { transform: translate(0,0) scale(1); }
      85%  { transform: translate(120px,90px) scale(1); }
      100% { transform: translate(120px,90px) scale(1); }
    }
    @keyframes piq-box-grow {
      0%   { width:0; height:0; opacity:0; }
      30%  { width:0; height:0; opacity:1; }
      85%  { width:120px; height:90px; opacity:1; }
      100% { width:120px; height:90px; opacity:0; }
    }
  `;
  document.head.appendChild(style);

  // ── Create overlay ───────────────────────────────────────────────────────
  overlayEl = document.createElement('div');
  overlayEl.id = 'partsiq-crop-overlay';

  // Tutorial hint
  const hintEl = document.createElement('div');
  hintEl.id = 'partsiq-crop-hint';
  hintEl.innerHTML = `
    <div class="piq-cursor">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="white"
           style="filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.7))">
        <path d="M3 0 L3 18 L7 14 L10 20 L12 19 L9 13 L14 13 Z"/>
      </svg>
    </div>
    <div class="piq-hint-box"></div>
  `;
  overlayEl.appendChild(hintEl);

  // Selection rectangle
  const selEl = document.createElement('div');
  selEl.id = 'partsiq-crop-selection';
  overlayEl.appendChild(selEl);

  document.body.appendChild(overlayEl);

  // Remove hint after animation
  let hintGone = false;
  const removeHint = () => {
    if (hintGone) return;
    hintGone = true;
    hintEl.remove();
  };
  const hintTimer = setTimeout(removeHint, 2500);

  // ── Drag logic ───────────────────────────────────────────────────────────
  let dragging = false;
  let startX = 0, startY = 0;

  const onMouseDown = (e: MouseEvent) => {
    clearTimeout(hintTimer);
    removeHint();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selEl.style.display = 'block';
    selEl.style.left   = startX + 'px';
    selEl.style.top    = startY + 'px';
    selEl.style.width  = '0px';
    selEl.style.height = '0px';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selEl.style.left   = x + 'px';
    selEl.style.top    = y + 'px';
    selEl.style.width  = w + 'px';
    selEl.style.height = h + 'px';
  };

  const onMouseUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 20 || h < 20) {
      selEl.style.display = 'none';
      return; // too small — let user retry
    }

    cleanup();
    const rect: CropRect = { x, y, width: w, height: h, devicePixelRatio: window.devicePixelRatio };
    safeSend({ type: 'crop_selected', rect });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      safeSend({ type: 'crop_cancelled' });
    }
  };

  overlayEl.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  function cleanup() {
    clearTimeout(hintTimer);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    overlayEl?.remove();
    document.getElementById('partsiq-crop-styles')?.remove();
    overlayEl = null;
  }
}

function safeSend(msg: object): void {
  if (!chrome.runtime?.id) return;
  chrome.runtime.sendMessage(msg).catch(() => {});
}
