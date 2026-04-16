---
name: require-i18n-design-system
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/components/.*\.tsx$
  - field: new_text
    operator: regex_match
    pattern: >[A-Z][a-z]+.*<|'[A-Z][a-z]{2,}[^']*'|"[A-Z][a-z]{2,}[^"]*"
action: block
---

**Hardcoded user-facing string detected in a component!**

This project uses `src/lib/i18n.ts` for all user-facing text with EN and NL translations.

**Rules:**
1. Add the string to both `en` and `nl` objects in `src/lib/i18n.ts`
2. Use the `useT(lang)` hook in the component: `const t = useT(lang);`
3. Reference via `t.yourKey` instead of a hardcoded string

**Design system reminders:**
- Primary color: `#00C6B2` (teal), text on primary: `#473150`
- Buttons: `rounded-full`, font `text-xs font-semibold`
- Font: Inter (loaded via Tailwind config)
- Status colors: sent=`#00C6B2`, error=`red-500`, sending=`opacity-50`

Check `src/lib/i18n.ts` for existing keys before adding new ones.
