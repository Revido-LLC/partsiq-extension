# Design: Bubble Tabs — `switch_to_order` Message Handler

**Date:** 2026-04-16

## Context

The Bubble app has a tab structure with a "Vehicle" tab and an "Order" tab. When a user clicks a tab, a Bubble workflow using "Run JavaScript" sends a `postMessage` to the extension sidepanel (which renders the Bubble page inside an iframe).

The `switch_to_vehicle` message already exists and is handled. The `switch_to_order` message is new and needs to be handled.

## Bubble Side (no code changes in this repo)

Each tab click triggers a Bubble workflow "Run JavaScript":

- **Vehicle tab:** `window.parent.postMessage({ type: "partsiq:switch_to_vehicle" }, "*")`
- **Order tab:** `window.parent.postMessage({ type: "partsiq:switch_to_order" }, "*")`

## Extension Side

**File:** `src/pages/sidepanel/Sidebar.tsx`

Add a new message handler in `useBubbleMessages`, immediately after the existing `switch_to_vehicle` block:

```ts
if (msg.type === 'partsiq:switch_to_order') {
  setWorkModeState('order');
  void setWorkMode('order');
  setVehicleExpanded(true);
  setState('idle');
  return;
}
```

**Behavior:** mirrors `switch_to_vehicle` exactly, but sets `workMode` to `'order'`, opening the iframe fullscreen for order selection.

## No Changes Required

- `BubbleMessage` type — already `{ type: string; [key: string]: unknown }`
- No new files
- No new storage keys
- No changes to other components
