# PartsIQ — OEM Part Number: Use Longest Code

> **Status:** Approved
> **Date:** 2026-04-29
> **Problem:** On supplier scans, some rows display a main part number and a shorter reference code below it. The AI was concatenating both side-by-side into the `oem` field instead of returning only the main part number.

---

## Root Cause

`EXTRACTION_PROMPT` in `src/lib/ai.ts` gave no instruction on how to handle multiple codes appearing for the same part. Gemini resolved the ambiguity by joining them.

## Design

**Single change:** add a disambiguation rule to the `oem` bullet in `EXTRACTION_PROMPT`.

### Before

```
- oem: part number / artikelnummer (may be in English or Dutch)
```

### After

```
- oem: part number / artikelnummer (may be in English or Dutch) — when multiple codes appear for the same part, use the longest one
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/ai.ts` | Update `oem` line in `EXTRACTION_PROMPT` |

**Nothing else changes:** `AiPart` interface, response parsing, and all consumers remain untouched.

## Success Criteria

- Scanning a supplier page that shows a main part number + shorter reference code returns only the longer code in `oem`
- No regression on pages with a single code per part
