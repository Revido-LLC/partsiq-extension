---
name: require-tests-before-stop
enabled: true
event: stop
pattern: .*
action: block
---

**Before completing, verify:**

1. Run `npx vitest run --environment jsdom` and confirm all tests pass
2. If you created or modified source files, ensure corresponding tests exist
3. If you modified UI components, verify they follow the design system (Parts iQ teal `#00C6B2`, rounded-full buttons, Inter font)
4. If you modified or added user-facing strings, ensure both EN and NL translations exist in `src/lib/i18n.ts`
5. Run `npx vite build --config vite.config.chrome.ts` and confirm it succeeds

Do NOT claim work is done until all applicable checks pass.
