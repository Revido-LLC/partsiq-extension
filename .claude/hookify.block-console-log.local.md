---
name: block-console-log
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/.*\.(ts|tsx)$
  - field: new_text
    operator: regex_match
    pattern: console\.(log|debug|info)\(
action: block
---

**console.log detected in source code!**

Debug logging was removed from this codebase after a review found it leaked pricing data and AI responses to DevTools.

**Rules:**
- Use `console.warn` or `console.error` only for genuine error conditions
- Never log full API responses, user data, or pricing information
- Test files (*.test.ts) are exempt from this rule

Remove the console.log before proceeding.
