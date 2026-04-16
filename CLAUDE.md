# Parts iQ Extension

Chrome/Firefox extension that captures part data from supplier websites and sends it to Parts iQ (Bubble.io app) via side panel iframes.

## Commands

```bash
npm install --legacy-peer-deps  # Install deps (peer dep conflicts require flag)
npm run build                   # Build Chrome extension → dist_chrome/
npm run build:firefox           # Build Firefox extension → dist_firefox/
npm run dev                     # Dev mode with hot reload (Chrome)
npx vitest run --environment jsdom  # Run tests
```

## Load in browser

Chrome: chrome://extensions → Developer mode → Load unpacked → select `dist_chrome/`
Dia/Arc: same flow, use dia://extensions or arc://extensions

## Architecture

```
src/
  background/       # Service worker (MV3)
  content/          # Content scripts (injected into all pages)
  pages/sidepanel/  # Side panel entry point → Sidebar.tsx (main state machine)
  components/
    BubbleIframe.tsx      # Shared iframe wrapper with auto-zoom correction
    panels/               # VehiclePanel, OrderPanel (collapsed header bars)
    states/               # LoginState, CartState, ScanningState, FallbackState, FinishState
    cart/                 # CartFooter
  lib/
    constants.ts    # Bubble URLs, API endpoints, storage keys
    iframe.ts       # buildBubbleUrl(), useBubbleMessages() hook
    ai.ts           # AI part extraction from screenshots
    screenshot.ts   # Tab screenshot capture
    storage.ts      # chrome.storage.local wrappers
    i18n.ts         # Translation hook
  types/parts.ts    # Shared types (Lang, WorkMode, SidebarState, CartItem, Vehicle, Order)
```

## Path aliases

@src/*, @assets/*, @lib/*, @components/*, @types/*, @pages/*, @locales/* → see tsconfig.json paths

## Key patterns

- **Bubble iframe communication**: Bubble pages post messages (partsiq:login_success, partsiq:vehicle_selected, etc.) to the extension via window.postMessage. The useBubbleMessages() hook in lib/iframe.ts listens for these.
- **Side panel state machine**: Sidebar.tsx manages states: checking → login → idle → scanning → cart → finish. The `vehicleExpanded` flag controls whether the iframe or collapsed header is shown.
- **Two work modes**: `vehicle` (select vehicle by plate) and `order` (select order via AutoFlex integration). Mode determined at login based on autoflex_connected.
- **BubbleIframe zoom correction**: Uses ResizeObserver to detect when the side panel is narrower than 370px (e.g. Dia browser over-scaling). Applies transform:scale() to give the iframe a wider viewport. No-op on standard Chrome.
- **Bubble version in URLs**: The BUBBLE_BASE_URL in constants.ts includes a version slug (version-138bg). This changes when the Bubble app is updated.

## Gotchas

- `npm install` requires `--legacy-peer-deps` due to @crxjs/vite-plugin peer conflicts
- Build output goes to dist_chrome/ (or dist_firefox/) — point "Load unpacked" there, NOT project root
- The manifest.json at project root is the SOURCE manifest (references .ts files). The built manifest in dist_chrome/ is the compiled one.
- Tailwind v4 is used (@import "tailwindcss" syntax, not @tailwind directives)
- VehiclePanel/OrderPanel only render the collapsed header bar — the expanded iframe is in Sidebar.tsx directly

## Branching

- main: production (default)
- staging: pre-production
- Feature branches → PR to staging → merge to main
