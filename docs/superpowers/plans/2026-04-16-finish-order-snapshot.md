# Finish Order Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar o `order` antes de limpar o estado em `handleFinish` para que `FinishState` receba o `order.id` correto e gere o link com `work-order-id`.

**Architecture:** Adicionar estado `finishOrder: Order | null` em `Sidebar.tsx` que é setado imediatamente antes da limpeza em `handleFinish` e resetado em `handleNewQuote`. `FinishState` já recebe `order: Order | null` e já tem a lógica de URL correta — nenhuma mudança lá.

**Tech Stack:** React 19, TypeScript, Chrome Extension Manifest V3

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `src/pages/sidepanel/Sidebar.tsx` | Adicionar `finishOrder` state, setar em `handleFinish`, resetar em `handleNewQuote`, passar para `<FinishState>` |

---

### Task 1: Adicionar `finishOrder` snapshot em Sidebar.tsx

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 1: Adicionar o estado `finishOrder`**

Em `src/pages/sidepanel/Sidebar.tsx`, logo após a linha com `const [iframeReady, setIframeReady] = useState(false);` (linha ~38), adicionar:

```typescript
const [finishOrder, setFinishOrder] = useState<Order | null>(null);
```

O bloco de estados ficará assim:
```typescript
const [vehicleExpanded, setVehicleExpanded] = useState(true);
const [scanError, setScanError] = useState<string | null>(null);
const [scanScreenshot, setScanScreenshot] = useState<string | null>(null);
const [loginError, setLoginError] = useState(false);
const [pendingUrl, setPendingUrl] = useState<string | null>(null);
const [iframeReady, setIframeReady] = useState(false);
const [finishOrder, setFinishOrder] = useState<Order | null>(null);
```

- [ ] **Step 2: Capturar order em `handleFinish` antes de limpar**

Localizar `handleFinish` (em torno da linha 323). Atualmente:

```typescript
const handleFinish = async () => {
  setCartState([]);
  setVehicleState(null);
  setOrderState(null);
  setPendingUrl(null);
  await Promise.all([setCart([]), setVehicle(null), setOrder(null)]);
  setState('finish');
};
```

Substituir por:

```typescript
const handleFinish = async () => {
  setFinishOrder(order);
  setCartState([]);
  setVehicleState(null);
  setOrderState(null);
  setPendingUrl(null);
  await Promise.all([setCart([]), setVehicle(null), setOrder(null)]);
  setState('finish');
};
```

- [ ] **Step 3: Resetar `finishOrder` em `handleNewQuote`**

Localizar `handleNewQuote` (em torno da linha 332). Atualmente:

```typescript
const handleNewQuote = () => {
  if (autoflex) {
    setWorkModeState('order');
    void setWorkMode('order');
  }
  setIframeReady(false);
  setVehicleExpanded(true);
  setState('idle');
};
```

Substituir por:

```typescript
const handleNewQuote = () => {
  setFinishOrder(null);
  if (autoflex) {
    setWorkModeState('order');
    void setWorkMode('order');
  }
  setIframeReady(false);
  setVehicleExpanded(true);
  setState('idle');
};
```

- [ ] **Step 4: Passar `finishOrder` para `<FinishState>`**

Localizar o render do `FinishState` (em torno da linha 380):

```typescript
return <FinishState lang={lang} workMode={workMode} order={order} onNewQuote={handleNewQuote} />;
```

Substituir por:

```typescript
return <FinishState lang={lang} workMode={workMode} order={finishOrder} onNewQuote={handleNewQuote} />;
```

- [ ] **Step 5: Verificar build**

```bash
cd C:/Users/Fillipe/partsiq-extension
npm run build
```

Esperado: `✓ built in X.XXs` sem erros TypeScript.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "fix: capturar order antes de limpar estado em handleFinish para link correto no FinishState"
```

---

## Teste manual

1. Login com conta autoflex → selecionar uma ordem
2. Escanear e salvar ao menos uma peça
3. Clicar "Finish search"
4. Verificar que o botão "Check status" abre a URL: `https://app.parts-iq.com/version-138bg/dash/autoflex//sourced-parts?work-order-id=<ID_DA_ORDEM>`
5. Clicar "New Quote" → verificar que volta ao fluxo normal
6. Repetir finish → verificar que o link ainda funciona com a nova ordem
