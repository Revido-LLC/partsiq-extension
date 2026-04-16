<div align="center">
<img src="public/icon-128.png" alt="Parts iQ logo"/>
<h1>Parts iQ — Browser Extension</h1>
<p>Capture auto parts from any supplier website and send them to <a href="https://app.parts-iq.com">Parts iQ</a></p>
</div>

## What it does

Parts iQ is a Chrome/Firefox extension that opens a **side panel** alongside any supplier website. It lets automotive professionals:

1. **Scan** a supplier page (or crop a specific area) to extract part data via AI
2. **Review** extracted parts — edit OEM numbers, check/uncheck items
3. **Send** selected parts to the Parts iQ platform with one click
4. **Finish** the search and view results in the Parts iQ dashboard

The extension communicates with the [Parts iQ Bubble app](https://app.parts-iq.com) via embedded iframes and API calls.

## Quick start

```bash
npm install --legacy-peer-deps   # Install dependencies
npm run build                    # Build for Chrome → dist_chrome/
npm run dev                      # Dev mode with hot reload
```

### Load in browser

| Browser | URL | Steps |
|---------|-----|-------|
| Chrome | `chrome://extensions` | Developer mode → Load unpacked → `dist_chrome/` |
| Dia | `dia://extensions` | Same as Chrome |
| Arc | `arc://extensions` | Same as Chrome |
| Firefox | `about:debugging` | Load temporary add-on → any file in `dist_firefox/` |

## Testing

```bash
npx vitest run --environment jsdom   # Run all 217 tests
npx vitest --environment jsdom       # Watch mode
```

217 tests across 10 files covering AI extraction, iframe communication, storage, translations, cart logic, and UI components.

## Architecture

```
src/
  background/         Service worker (MV3) — screenshot capture, crop, message relay
  content/            Content scripts — URL change detection, crop overlay
  pages/sidepanel/    Side panel entry → Sidebar.tsx (main state machine)
  components/
    BubbleIframe.tsx  Shared iframe wrapper with auto-zoom for Dia/Arc
    panels/           VehiclePanel, OrderPanel (collapsed header bars)
    states/           LoginState, CartState, ScanningState, FallbackState, FinishState
  lib/
    ai.ts             AI part extraction via Bubble API (30s timeout)
    cart-utils.ts     Pure functions: mergeCart(), aiPartsToCartItems()
    constants.ts      Bubble URLs, API endpoints, storage keys
    i18n.ts           EN/NL translations
    iframe.ts         buildBubbleUrl(), useBubbleMessages() hook
    image-utils.ts    Shared dataUrlToBlob()
    screenshot.ts     Multi-viewport screenshot capture
    storage.ts        chrome.storage.local wrappers with cart date expiry
  types/parts.ts      Shared TypeScript types
```

## Key concepts

- **State machine**: Sidebar.tsx manages: `checking → login → idle → scanning → cart → finish`
- **Two work modes**: `vehicle` (select by plate) and `order` (AutoFlex integration)
- **Bubble communication**: The Bubble app posts messages (`partsiq:login_success`, `partsiq:vehicle_selected`, etc.) via `window.postMessage`
- **Auto-zoom**: BubbleIframe detects narrow side panels (< 370px, common in Dia/Arc) and applies `transform: scale()` correction. No-op on standard Chrome.

## Configuration

All Bubble URLs are built from a single version constant in `src/lib/constants.ts`:

```ts
const BUBBLE_VERSION = 'version-138bg';
```

When Bubble deploys a new version, update this one line.

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Production (default) |
| `staging` | Pre-production |
| Feature branches | PR to `staging` → merge to `main` |

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)

## License

MIT
