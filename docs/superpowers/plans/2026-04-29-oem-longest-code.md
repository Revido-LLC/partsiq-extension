# OEM Longest-Code Prompt Rule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a disambiguation rule to the AI extraction prompt so that when a supplier page shows multiple codes for the same part, only the longest one is returned as the OEM part number.

**Architecture:** Single-line change to the `oem` bullet in `EXTRACTION_PROMPT` inside `src/lib/ai.ts`. A test in `src/lib/ai.test.ts` verifies the new instruction is included in the prompt sent to the endpoint.

**Tech Stack:** TypeScript, Vitest, jsdom

---

## File Map

| File | Change |
|------|--------|
| `src/lib/ai.ts` | Update `oem` line in `EXTRACTION_PROMPT` |
| `src/lib/ai.test.ts` | Add 1 test: prompt body contains the longest-code instruction |

---

### Task 1: Update the prompt and verify with a test

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/ai.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/ai.test.ts`, add a new `describe` block after the existing `'HTTP request'` describe block (around line 83). The test inspects the `prompt` field sent in the fetch body:

```typescript
describe('extraction prompt', () => {
  it('instructs the AI to use the longest code when multiple codes appear', async () => {
    mockFetch(200, { parts: [] });

    await extractPartsFromScreenshot('img');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.prompt).toContain('when multiple codes appear for the same part, use the longest one');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd C:/Users/Fillipe/partsiq-extension
npx vitest run src/lib/ai.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 1 failure — `expect(received).toContain(expected)` — the current prompt does not contain that instruction.

- [ ] **Step 3: Update the prompt in `src/lib/ai.ts`**

Current `oem` line (line 7):
```typescript
- oem: part number / artikelnummer (may be in English or Dutch)
```

Replace with:
```typescript
- oem: part number / artikelnummer (may be in English or Dutch) — when multiple codes appear for the same part, use the longest one
```

The full updated `EXTRACTION_PROMPT` becomes:

```typescript
const EXTRACTION_PROMPT = `Extract auto parts from this supplier website screenshot.
Return a JSON array where each object has:
- name: part name/description
- oem: part number / artikelnummer (may be in English or Dutch) — when multiple codes appear for the same part, use the longest one
- price: net price as number without currency symbol (prijs), or null
- delivery_days: delivery time as integer days (levertijd), or null
- stock: stock quantity as integer (voorraad), or null
- supplier: supplier name if visible (leverancier), or empty string

Data may appear in English or Dutch. Return ONLY a valid JSON array, no markdown, no explanation. If no parts found, return [].`;
```

- [ ] **Step 4: Run the tests and verify all pass**

```bash
npx vitest run src/lib/ai.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts
git commit -m "fix: instruct AI to use longest code when multiple OEM codes appear"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|-----------|
| `oem` bullet updated with longest-code rule | Step 3 |
| Test verifies the instruction reaches the endpoint | Steps 1–2 |
| No other files change | Only 2 files touched |
