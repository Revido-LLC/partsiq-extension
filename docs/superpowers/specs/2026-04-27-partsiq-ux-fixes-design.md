# PartsIQ Extension — UX Fixes (2026-04-27)

> **Status:** Approved — ready for implementation
> **Date:** 2026-04-27
> **Scope:** 3 targeted UX fixes: same-tab navigation, cart cleanup on rescan, background color

---

## Mudança 1 — FinishState: abrir no mesmo tab

### Problema

O link "Check part status" em `FinishState.tsx` usa `<a target="_blank">`, que no contexto de um Chrome sidepanel abre uma nova aba em vez de navegar na aba ativa.

### Solução

Substituir o `<a>` por um `<button>` que chama `chrome.tabs.update({ url: dashUrl })` para navegar na aba ativa atual.

### Arquivo afetado

`src/components/states/FinishState.tsx`

### Antes

```tsx
<a
  href={dashUrl}
  target="_blank"
  rel="noreferrer"
  className="..."
>
  {t.checkStatus}
</a>
```

### Depois

```tsx
<button
  onClick={() => chrome.tabs.update({ url: dashUrl })}
  className="..."
>
  {t.checkStatus}
</button>
```

Estilo visual: idêntico ao anterior (mesma classe CSS). Nenhuma nova permissão necessária — `tabs` já está no manifest para `chrome.tabs.query`.

---

## Mudança 2 — Limpeza do carrinho ao fazer novo scan

### Problema (dois sub-bugs)

**Sub-bug A — FallbackState esconde itens enviados:**
Quando um scan retorna 0 peças, `processScan` chama `setState('fallback')` sem atualizar o cart. O `FallbackState` não recebe `cart` como prop, então os itens já enviados ficam invisíveis para o usuário.

**Sub-bug B — Mistura de itens pendentes de scans anteriores:**
`mergeCart` remove apenas itens `pending`/`error` da **mesma URL** do scan atual. Itens pendentes de outras URLs nunca são limpos, misturando-se com resultados de novos scans.

### Solução

**Sub-fix A:** Passar `cart` como prop para `FallbackState`. Se houver itens com `status === 'sent'`, exibi-los em uma seção "Peças já enviadas" acima da mensagem "nenhuma peça encontrada".

**Sub-fix B:** Em `processScan` (em `Sidebar.tsx`), antes de chamar `mergeCart`, remover do `cartRef.current` todos os itens `pending` e `error` **independente de URL**. Itens `sent` e `sending` sempre preservados. Isso garante que um novo scan sempre apresente uma lista limpa de resultados + peças já confirmadas.

A lógica de `mergeCart` em `cart-utils.ts` pode ser simplificada: como o `processScan` já entrega apenas itens `sent`/`sending` para o merge, a filtragem por URL torna-se desnecessária. `mergeCart` passa a simplesmente concatenar `existing + incoming`.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/sidepanel/Sidebar.tsx` | `processScan`: limpar `pending`/`error` do cart antes do merge. `FallbackState`: passar `cart` como prop |
| `src/components/states/FallbackState.tsx` | Aceitar prop `cart: CartItem[]`, exibir itens `sent` se existirem |
| `src/lib/cart-utils.ts` | Simplificar `mergeCart`: remover filtragem por URL (agora redundante) |
| `src/lib/cart-utils.test.ts` | Atualizar testes do `mergeCart` para o novo comportamento |

### Fluxo corrigido (exemplo)

```
Scan 1 (crop) → 5 itens → usuário envia 2 → cart: [2 sent, 3 pending]

Scan 2 → 0 peças:
  - processScan: limpa pending/error → cart fica [2 sent]
  - setState('fallback') com cart=[2 sent]
  - FallbackState exibe "2 peças já enviadas" + "nenhuma nova peça encontrada"

Scan 3 → 5 peças:
  - processScan: limpa pending/error → cart ainda [2 sent] (nada a limpar)
  - mergeCart([2 sent], [5 new]) → [2 sent, 5 new]
  - setState('cart') → lista limpa sem mistura
```

---

## Mudança 3 — Cor de fundo

### Problema

O fundo da extensão é `#FFFFFF` (branco), mas o sidebar do app PartsIQ usa `#F0F0F0`. O contraste cria descontinuidade visual ao usar a extensão junto ao app.

### Solução

Substituir `bg-white` pelo equivalente de `#F0F0F0` (`bg-[#F0F0F0]`) nos containers raiz que atualmente definem fundo branco.

### Arquivos afetados

| Arquivo | Elemento | Mudança |
|---------|----------|---------|
| `src/pages/sidepanel/Sidebar.tsx` | `<div className="relative h-full">` (login/checking) | `bg-white` → `bg-[#F0F0F0]` |
| `src/pages/sidepanel/Sidebar.tsx` | `<div className="flex flex-col h-screen">` (cart/fallback/scanning) | adicionar `bg-[#F0F0F0]` |
| `src/components/states/CartState.tsx` | `<div className="relative flex flex-col h-full">` | adicionar `bg-[#F0F0F0]` |
| `src/components/states/FallbackState.tsx` | `<div className="flex flex-col h-full">` | adicionar `bg-[#F0F0F0]` |
| `src/components/states/ScanningState.tsx` | containers raiz | substituir/adicionar `bg-[#F0F0F0]` |

O spinner overlay de login (`bg-white`) **não é alterado** — ele existe para mascarar o flash do iframe Bubble e precisa ser branco para cobrir qualquer conteúdo abaixo.

---

## Design System — token atualizado

| Token | Antes | Depois |
|-------|-------|--------|
| Background | `#FFFFFF` | `#F0F0F0` |

---

## Testes

- `cart-utils.test.ts`: atualizar casos de `mergeCart` (nova assinatura sem filtragem por URL)
- `CartState.test.tsx`: verificar que lógica de envio/remoção não foi afetada
- Manual: fluxo completo crop→send→rescan→fallback→rescan para validar sub-bugs A e B
