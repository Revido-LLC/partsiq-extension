---
name: require-build-before-push
enabled: true
event: bash
pattern: git\s+push
action: warn
---

**Rebuild before pushing!**

The `dist_chrome/` build output must be current before pushing. Stale builds have caused runtime errors in production (missing `.catch()` handlers, outdated content scripts).

**Before pushing, run:**
1. `npx vite build --config vite.config.chrome.ts`
2. `npx vitest run --environment jsdom`

Only push after both succeed.
