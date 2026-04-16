# Bubble Tabs — `switch_to_order` Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle the `partsiq:switch_to_order` postMessage sent by Bubble's tab UI, mirroring the existing `switch_to_vehicle` behavior.

**Architecture:** A single new `if` block in `Sidebar.tsx`'s `useBubbleMessages` callback sets `workMode` to `'order'`, expands the iframe panel, and resets state to `'idle'`. No new files, types, or storage keys needed.

**Tech Stack:** React 19, TypeScript, Vitest + jsdom, @testing-library/react

---

### Task 1: Add `switch_to_order` handler in `Sidebar.tsx`

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx` (inside `useBubbleMessages` callback, after line 222)

- [ ] **Step 1: Open `src/pages/sidepanel/Sidebar.tsx` and locate the `switch_to_vehicle` handler**

  It looks like this (around line 216):

  ```ts
  if (msg.type === 'partsiq:switch_to_vehicle') {
    setWorkModeState('vehicle');
    void setWorkMode('vehicle');
    setVehicleExpanded(true);
    setState('idle');
    return;
  }
  ```

- [ ] **Step 2: Add the `switch_to_order` block immediately after it**

  ```ts
  if (msg.type === 'partsiq:switch_to_order') {
    setWorkModeState('order');
    void setWorkMode('order');
    setVehicleExpanded(true);
    setState('idle');
    return;
  }
  ```

  The full `useBubbleMessages` block should now end with both handlers side by side:

  ```ts
    if (msg.type === 'partsiq:switch_to_vehicle') {
      setWorkModeState('vehicle');
      void setWorkMode('vehicle');
      setVehicleExpanded(true);
      setState('idle');
      return;
    }

    if (msg.type === 'partsiq:switch_to_order') {
      setWorkModeState('order');
      void setWorkMode('order');
      setVehicleExpanded(true);
      setState('idle');
      return;
    }
  });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/sidepanel/Sidebar.tsx
  git commit -m "feat: handle partsiq:switch_to_order message from Bubble tabs"
  ```

---

### Task 2: Build and verify

**Files:**
- No file changes

- [ ] **Step 1: Run the build**

  ```bash
  cd ~/partsiq-extension
  npm run build
  ```

  Expected output ends with: `✓ built in X.XXs`

- [ ] **Step 2: Reload the extension in Chrome**

  Go to `chrome://extensions`, click the reload icon on "Parts iQ", confirm the extension loads without errors in the service worker console.

- [ ] **Step 3: Verify existing `switch_to_vehicle` still works**

  In the Bubble app, click the Vehicle tab. The extension sidepanel should switch to `workMode = 'vehicle'` and show the iframe fullscreen.

- [ ] **Step 4: Verify new `switch_to_order` works**

  In the Bubble app, click the Order tab. The extension sidepanel should switch to `workMode = 'order'` and show the iframe fullscreen.
