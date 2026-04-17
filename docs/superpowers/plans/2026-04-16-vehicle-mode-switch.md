# Vehicle Mode Switch (Autoflex) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuários com Autoflex conectado façam buscas por veículo (sem ordem) clicando em um botão na página Bubble de seleção de ordem.

**Architecture:** O Bubble envia `partsiq:switch_to_vehicle` via postMessage quando o botão é clicado. A extensão muda `workMode` para `'vehicle'` e mantém o iframe aberto (Bubble já navegou internamente para seleção de veículo). Ao expandir o painel novamente com autoflex ativo, o `workMode` é resetado para `'order'`. O campo `autoflex_integration` no `save_part` passa a depender de `workMode` em vez de `autoflex`.

**Tech Stack:** React 19, TypeScript, Chrome Extension Manifest V3, Bubble postMessage protocol

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `src/components/states/CartState.tsx` | Corrigir lógica de `autoflex_integration` |
| `src/pages/sidepanel/Sidebar.tsx` | Adicionar handler `partsiq:switch_to_vehicle` + reset de modo no onExpand |

---

### Task 1: Corrigir `autoflex_integration` em CartState.tsx

**Files:**
- Modify: `src/components/states/CartState.tsx:59`

Este campo determina se a peça vai para o fluxo Autoflex no Bubble. A lógica atual (`autoflex ? 'yes' : 'no'`) está errada: quando o usuário tem Autoflex mas escolhe buscar por veículo, `autoflex=true` mas não deve integrar com Autoflex. A lógica correta é baseada em `workMode`.

- [ ] **Step 1: Editar CartState.tsx**

Localizar linha 59 em `src/components/states/CartState.tsx`:
```typescript
autoflex_integration: autoflex ? 'yes' : 'no',
```

Substituir por:
```typescript
autoflex_integration: workMode === 'order' ? 'yes' : 'no',
```

- [ ] **Step 2: Verificar build**

```bash
cd C:/Users/Fillipe/partsiq-extension
npm run build
```

Esperado: build sem erros em `dist_chrome/`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/components/states/CartState.tsx
git commit -m "fix: autoflex_integration baseado em workMode, nao em autoflex flag"
```

---

### Task 2: Adicionar handler `partsiq:switch_to_vehicle` em Sidebar.tsx

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx` (dentro de `useBubbleMessages`)

Quando o Bubble envia esta mensagem, a extensão deve mudar o `workMode` para `'vehicle'` e persistir no storage. O iframe não é recarregado — o Bubble já navegou internamente para seleção de veículo, e o próximo evento esperado é `partsiq:vehicle_selected`.

- [ ] **Step 1: Adicionar handler no useBubbleMessages**

Em `src/pages/sidepanel/Sidebar.tsx`, dentro do callback do `useBubbleMessages`, após o bloco `if (msg.type === 'partsiq:order_selected') { ... }` (linha ~217), adicionar:

```typescript
if (msg.type === 'partsiq:switch_to_vehicle') {
  setWorkModeState('vehicle');
  void setWorkMode('vehicle');
  return;
}
```

O trecho após a inserção ficará assim:
```typescript
    if (msg.type === 'partsiq:order_selected') {
      const plate = (msg.plate as string) ?? '';
      const id = (msg.id as string) ?? '';
      if (!id) return;

      const o: Order = { plate, id };
      const hadOrder = !!orderRef.current;

      if (hadOrder) {
        void setCart([]);
        setCartState([]);
      }

      setOrderState(o);
      void setOrder(o);
      setState('cart');
      setVehicleExpanded(false);
    }

    if (msg.type === 'partsiq:switch_to_vehicle') {
      setWorkModeState('vehicle');
      void setWorkMode('vehicle');
      return;
    }
  });
```

- [ ] **Step 2: Verificar build**

```bash
cd C:/Users/Fillipe/partsiq-extension
npm run build
```

Esperado: build sem erros.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "feat: handle partsiq:switch_to_vehicle para modo veiculo sem ordem Autoflex"
```

---

### Task 3: Resetar workMode ao expandir painel no modo Autoflex

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx` (prop `onExpand` do VehiclePanel)

Quando o usuário está em modo veículo (por ter clicado "buscar por veículo") e clica no header "Change vehicle", o iframe recarrega e o Bubble volta a mostrar a seleção de ordem (porque `autoflex=true` no lado do Bubble). A extensão deve acompanhar e resetar `workMode='order'`.

- [ ] **Step 1: Modificar onExpand do VehiclePanel**

Em `src/pages/sidepanel/Sidebar.tsx`, localizar o bloco do `VehiclePanel` no `panelHeader` (linhas ~382-390):

```typescript
    : (
      <VehiclePanel
        vehicle={vehicle}
        expanded={vehicleExpanded}
        lang={lang}
        iframeReady={iframeReady}
        onExpand={() => { setIframeReady(false); setVehicleExpanded(true); setState('idle'); }}
      />
    );
```

Substituir por:

```typescript
    : (
      <VehiclePanel
        vehicle={vehicle}
        expanded={vehicleExpanded}
        lang={lang}
        iframeReady={iframeReady}
        onExpand={() => {
          if (autoflex) {
            setWorkModeState('order');
            void setWorkMode('order');
          }
          setIframeReady(false);
          setVehicleExpanded(true);
          setState('idle');
        }}
      />
    );
```

- [ ] **Step 2: Verificar build**

```bash
cd C:/Users/Fillipe/partsiq-extension
npm run build
```

Esperado: build sem erros.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "feat: resetar workMode para order ao expandir painel com autoflex ativo"
```

---

## Teste manual (após as 3 tasks)

Carregar `dist_chrome/` no Chrome (chrome://extensions modo desenvolvedor).

**Fluxo principal:**
1. Login com conta autoflex_connected=true → OrderPanel aparece (iframe de seleção de ordem)
2. No Bubble, clicar no botão "Buscar por veículo" → Bubble envia `partsiq:switch_to_vehicle`
3. Verificar: `workMode` mudou para `'vehicle'` (VehiclePanel deve aparecer no header quando fechar o iframe)
4. Selecionar um veículo no Bubble → `partsiq:vehicle_selected` → cart state
5. Escanear uma página → salvar uma peça → verificar no Bubble que `autoflex_integration = 'no'` e `work_mode = 'vehicle'`

**Fluxo de volta para ordem:**
6. Clicar em "Change vehicle" no header → iframe recarrega → Bubble mostra seleção de ordem
7. Selecionar uma ordem → `partsiq:order_selected` → cart state
8. Salvar uma peça → verificar no Bubble que `autoflex_integration = 'yes'` e `work_mode = 'order'`

**Fluxo original (sem mudança de modo):**
9. Login com autoflex_connected=true → selecionar ordem diretamente → salvar peça → `autoflex_integration = 'yes'` ✓
10. Login com autoflex_connected=false → selecionar veículo → salvar peça → `autoflex_integration = 'no'` ✓
