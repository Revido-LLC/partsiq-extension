# Autoflex Integration — Design Spec

**Date:** 2026-04-09
**Status:** Approved

---

## Context

PartsIQ is a Chrome sidebar extension used by mechanics to capture parts data from supplier websites via AI screenshot, then send items to PartsIQ (Bubble) for price comparison.

Today the flow is: login → select vehicle (Bubble iframe) → scan → cart → finalize.

This spec introduces Autoflex integration: when a user has Autoflex connected, they work with **orders** instead of vehicles. The selection UI stays inside the Bubble iframe — the extension only needs to know the mode and send the right identifier.

---

## New Flow

```
Open PartsIQ
    ↓
Login (existing)
    ↓
autoflex_connected? (from session endpoint)
    ├── YES → Bubble iframe /extension (shows orders)
    │              ↓ user selects order
    │          run_java(order_unique_id, plate)
    │              ↓
    │          Scan/Cart — header: plate + "Change order"
    │              ↓ save_part / remove_part
    │          payload: { order_id: "xxx", vehicle_id: "" }
    │
    └── NO  → Bubble iframe /extension (shows vehicles — unchanged)
                   ↓ user selects vehicle
               run_java(vehicle_unique_id, plate)
                   ↓
               Scan/Cart — header: plate + "Change car"
                   ↓ save_part / remove_part
               payload: { vehicle_id: "xxx", order_id: "" }
```

---

## State / Context

Extend the existing app context:

```typescript
type WorkMode = 'vehicle' | 'order'

interface AppContext {
  // existing
  vehicle: { id: string; plate: string } | null

  // new
  workMode: WorkMode            // set at login, does not change during session
  autoflex_connected: boolean   // from login/session response
  order: { id: string; plate: string } | null
}
```

- `workMode` is derived from `autoflex_connected` at login and remains fixed for the session
- `order` follows the same lifecycle as `vehicle` today: persists for the current day, cleared on "Finalizar"
- `save_part` and `remove_part` send `order_id` OR `vehicle_id` based on `workMode`; the other field is sent as empty string

---

## Components

### Modified

| Component | Change |
|-----------|--------|
| App / context | Store `workMode` + `autoflex_connected` after login |
| `run_java` handler | Distinguish order vs vehicle based on `workMode`; set `order` or `vehicle` in context |
| Header | Show "Change order" or "Change car" based on `workMode` |
| `save_part` / `remove_part` calls | Send `order_id` or `vehicle_id` in the correct field |

### Not changed

- `VehiclePanel` / Bubble iframe `/extension` — selection UI stays entirely in Bubble; Bubble internally decides whether to show vehicles or orders
- Cart logic, scan logic, crop logic — unchanged
- Login flow — only the session response needs the new field

---

## Bubble Changes

| Item | Change |
|------|--------|
| Session endpoint (run_java) | Add `autoflex_connected: boolean` to response |
| `save_part` workflow | Add `order_id` field (string, optional) |
| `remove_part` workflow | Add `order_id` field (string, optional) |

---

## Payload Reference

**save_part (vehicle mode):**
```json
{ "vehicle_id": "abc123", "order_id": "", "vehicle_plate": "AA-123-BB", "source_url": "..." }
```

**save_part (order mode):**
```json
{ "vehicle_id": "", "order_id": "ord_xyz", "vehicle_plate": "AA-123-BB", "source_url": "..." }
```

---

## Out of Scope

- UI changes inside the Bubble `/extension` page — handled by Bubble
- Any new panel/screen in the extension for order selection
- Changes to scan, crop, or cart logic
