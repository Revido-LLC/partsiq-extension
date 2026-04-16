# Finish State Order Snapshot — Design

## Problem

`handleFinish` limpa `order` com `setOrderState(null)` antes de `setState('finish')`. React batches as atualizações, então quando `FinishState` renderiza, `order` já é `null`. O link "Check status" cai no fallback `/dash/autoflex` sem o `work-order-id`.

## Fix

Adicionar estado `finishOrder: Order | null` que captura o `order` no momento exato em que o usuário clica "Finish", antes da limpeza.

## Changes

**`src/pages/sidepanel/Sidebar.tsx`:**
1. Adicionar estado: `const [finishOrder, setFinishOrder] = useState<Order | null>(null)`
2. Em `handleFinish`: chamar `setFinishOrder(order)` ANTES de `setOrderState(null)`
3. Em `handleNewQuote`: chamar `setFinishOrder(null)` para resetar
4. Na renderização do `FinishState`: trocar `order={order}` por `order={finishOrder}`

**`src/components/states/FinishState.tsx`:** nenhuma mudança — já recebe `order: Order | null` e constrói a URL corretamente.

## Edge Cases

- Se `order` for `null` no momento de finish (fluxo veículo): `finishOrder` fica `null`, URL cai no fallback `/dash/parts`. Correto.
- Usuário abre nova sessão: `finishOrder` começa como `null` (useState default). Correto.
