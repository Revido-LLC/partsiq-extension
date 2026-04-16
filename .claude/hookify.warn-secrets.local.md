---
name: warn-secrets
enabled: true
event: file
conditions:
  - field: new_text
    operator: regex_match
    pattern: (API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|credentials)\s*[:=]
action: block
---

**Potential secret or credential detected!**

You are writing what appears to be a secret, API key, or credential directly into source code.

**Rules:**
- Never hardcode secrets in source files
- Use environment variables or `chrome.storage.local` for sensitive values
- The Bubble API URLs in `src/lib/constants.ts` are public endpoints (OK)
- If this is a test file with mock values, proceed with caution

Verify this is not a real credential before continuing.
