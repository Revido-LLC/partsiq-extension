# PartsIQ Extension — Sidepanel Design Spec

> **Status:** Implemented & Tested
> **Date:** 2026-04-10
> **Updated:** 2026-04-13
> **Approach:** Clean rewrite — sidepanel UI from scratch, reusing background.ts / storage.ts / ai.ts utilities

---

## O que é o PartsIQ

Extensão Chrome usada por **mecânicos** enquanto navegam em sites de fornecedores de peças automotivas. Com um clique, captura um screenshot da página atual, envia para um modelo de visão via Bubble proxy, e extrai automaticamente dados das peças: nome, part number, preço, prazo de entrega, estoque, fornecedor.

As peças extraídas vão para um carrinho no sidebar. O mecânico confere, marca as que quer, e elas são salvas no Bubble associadas ao veículo ou ordem selecionada.

---

## Paradigma de UI

**Sidebar apenas.** O popup foi descontinuado.

- `manifest.json`: remove `default_popup`, adiciona `side_panel` permission + `sidePanel` entry
- `host_permissions`: `["https://app.parts-iq.com/*", "<all_urls>"]`
- O ícone da extensão na barra do Chrome abre o sidebar via `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` no background
- Ícone: logo PartsIQ (iQ) em roxo, gerado em 16/32/48/128px

---

## Estrutura de Arquivos

```
src/
├── background/index.ts          # service worker: screenshot, crop, relay URL
├── content/index.ts             # detecta mudança de URL, crop hint animation, crop overlay, ping
├── pages/
│   └── sidepanel/
│       ├── index.html           # html/body/#root com height:100%
│       ├── index.tsx            # mount React
│       └── Sidebar.tsx          # máquina de estados principal
├── components/
│   ├── panels/
│   │   ├── VehiclePanel.tsx     # badge compacta + iframe /extension (fluxo veículo)
│   │   └── OrderPanel.tsx       # badge compacta + iframe /extension (fluxo ordem)
│   └── states/
│       ├── LoginState.tsx       # iframe /auth/log-in fullscreen (10px margem lateral)
│       ├── ScanningState.tsx    # thumbnail screenshot + spinner overlay + t.analyzing
│       ├── CartState.tsx        # lista de peças + checkbox send/unsend + manual add
│       ├── FallbackState.tsx    # 0 peças encontradas — input manual, scan ou crop
│       └── FinishState.tsx      # confirmação de busca finalizada
├── lib/
│   ├── iframe.ts                # buildBubbleUrl(?source=extension só no login), useBubbleMessages
│   ├── storage.ts               # cart, authStatus, vehicle, order, lang, workMode
│   ├── ai.ts                    # chama Bubble proxy, parseia data.response.parts
│   ├── screenshot.ts            # captureVisibleTab direto no sidepanel, multi-scroll até 8 viewports
│   └── constants.ts             # BUBBLE_BASE_URL, endpoints
└── types/parts.ts               # CartItem, SidebarState, WorkMode, Lang
```

---

## Máquina de Estados

```
checking → login → idle → cart → finish
                     ↑      ↓       ↓
                     └──────┘   (nova cotação → idle)
                            ↓
                         scanning
                         /      \
                      cart    fallback → cart
```

| Estado | Descrição |
|--------|-----------|
| `checking` | Spinner + iframe oculto `/auth/log-in?source=extension`. Timeout 3s → `login` |
| `login` | iframe `/auth/log-in?source=extension` fullscreen. Aguarda `partsiq:login_success` |
| `idle` | VehiclePanel ou OrderPanel expandido (iframe Bubble). Aguarda seleção |
| `scanning` | Mostra thumbnail do screenshot + spinner. Chama proxy + processa peças |
| `cart` | Lista de peças. Scan/crop disponíveis. Botão Finalizar |
| `fallback` | 0 peças encontradas. Input manual, scan ou crop |
| `finish` | Confirmação. Botão "Nova cotação" → volta para `idle` |

---

## Protocolo de Mensagens

### Bubble → Extensão (`postMessage` via iframe)

| Tipo | Payload | Ação |
|------|---------|------|
| `partsiq:login_success` | `{ userId, language, autoflex_connected }` | salva auth, define `workMode` + `lang` + `autoflex`. Se já há veículo/ordem no storage → vai para `cart`. Caso contrário → `idle` |
| `partsiq:login_failed` | — | mostra `loginError = true` |
| `partsiq:vehicle_selected` | `{ plate, id }` | salva veículo, recolhe VehiclePanel, vai para `cart` |
| `partsiq:order_selected` | `{ plate, id }` | salva ordem, recolhe OrderPanel, vai para `cart` |

### Extensão → Background (`chrome.runtime.sendMessage`)

| Tipo | Payload | Resposta |
|------|---------|----------|
| `take_crop_init` | `{ tabId }` | `{ ok }` — injeta content script se necessário, dispara crop hint + overlay |
| `crop_done` (content → bg) | `{ rect, dpr }` | bg captura + recorta → envia `crop_ready` ao sidebar |
| `url_changed` (content → bg) | `{ url }` | relay como `page_url_changed` ao sidebar |

### Background → Sidebar

| Tipo | Payload | Ação |
|------|---------|------|
| `page_url_changed` | `{ url }` | mostra banner "Página mudou" se em `cart` ou `idle` |
| `crop_ready` | `{ imageBase64 }` ou `{ error }` | vai para `scanning`, processa imagem recortada |

---

## Storage Local (`chrome.storage.local`)

```typescript
{
  authStatus: boolean,
  lang: 'en' | 'nl',
  workMode: 'vehicle' | 'order',
  autoflex: boolean,             // true se autoflex_connected = 'yes' no login
  vehicle: { plate: string, id: string } | null,
  order: { plate: string, id: string } | null,
  cart: CartItem[],
  cartDate: string,              // ISO date YYYY-MM-DD — cart é limpo automaticamente ao mudar de dia
}
```

**Regras de persistência do carrinho:**
- Persiste entre aberturas do sidepanel (mesmo dia)
- Limpo automaticamente ao mudar de dia (comparação por `cartDate`)
- Limpo ao clicar em "Finish search"
- Limpo ao trocar de veículo ou ordem

---

## Tipos Centrais

```typescript
type Lang = 'en' | 'nl';
type WorkMode = 'vehicle' | 'order';
type SidebarState = 'checking' | 'login' | 'idle' | 'scanning' | 'cart' | 'fallback' | 'finish';

type CartItem = {
  id: string;                // uuid local
  name: string;
  oem: string;               // part number / artikelnummer
  price: number | null;
  deliveryDays: number | null;
  stock: number | null;
  supplier: string;
  sourceUrl: string;
  scannedAt: string;         // ISO timestamp
  status: 'pending' | 'sending' | 'sent' | 'error';
  errorMsg?: string;
  bubblePartId?: string;
  checked: boolean;
};
```

---

## Fluxo de Login / Auth Check

Ao abrir a extensão, sempre inicia em `checking`:

1. Renderiza spinner + iframe **oculto** (`display:none`) apontando para `/auth/log-in?source=extension`
2. Bubble carrega a página e, se usuário está logado, dispara `partsiq:login_success` automaticamente
3. Se recebido → verifica se há veículo/ordem em storage:
   - **Sim** → transita para `cart` com carrinho e contexto persistidos
   - **Não** → transita para `idle` (seleção de veículo/ordem)
4. Se **3 segundos** passam sem resposta → `authStatus = false` → transita para `login`

**LoginState** renderiza iframe fullscreen com 10px de margem lateral. Sem rodapé de erro — o Bubble exibe feedback de login nativo.

- `partsiq:login_success` recebido:
  - `lang` define idioma da UI (`'en'` | `'nl'`) — sem opção de troca na extensão
  - `autoflex_connected === 'yes'` → `workMode = 'order'`, `autoflex = true` → mostra OrderPanel
  - `autoflex_connected !== 'yes'` → `workMode = 'vehicle'`, `autoflex = false` → mostra VehiclePanel
  - `autoflex` salvo em storage (`partsiq_autoflex`)

**Nota Bubble:** O workflow "User is logged in" roda apenas quando `?source=extension` está na URL. O `postMessage` é enviado diretamente no script JS (sem `param1`) com `autoflex_connected` como dado dinâmico inline. Condição: `Get source from page URL is extension`.

---

## Fluxo de Seleção (Idle)

### VehiclePanel (`workMode = 'vehicle'`)

- **Expandido**: iframe fullscreen para `/extension` no Bubble — busca veículo pela placa
- Bubble envia `partsiq:vehicle_selected` com `{ plate, id }`
- Painel recolhe para badge compacta: `"KCV-1235"` com botão "Change vehicle"
- Sidebar transita para `cart` (carrinho vazio — usuário inicia scan manualmente)
- "Change vehicle" → `setState('idle')` + `setVehicleExpanded(true)`, limpa carrinho se havia veículo anterior

### OrderPanel (`workMode = 'order'`)

- **Expandido**: iframe fullscreen para `/extension` no Bubble — busca ordem pela placa
- Bubble envia `partsiq:order_selected` com `{ plate, id }`
- Painel recolhe para badge compacta com botão "Change order"
- Sidebar transita para `cart` (carrinho vazio — usuário inicia scan manualmente)
- "Change order" → `setState('idle')` + `setVehicleExpanded(true)`, limpa carrinho se havia ordem anterior

**Importante:** `useBubbleMessages` registrado em `Sidebar.tsx` (sempre ativo). Guarda por `isLoggedInRef.current` para ignorar mensagens antes do login.

---

## Fluxo de Scan

### Screenshot Completo (`handleScan`)

1. Chama `captureScreenshot()` diretamente no sidepanel (sem background)
2. Content script reporta `scrollHeight` + `viewportHeight` via `get_page_info`
3. Scroll automático captura até **8 viewports** de altura, espaçados por `viewportHeight`
4. Imagens stitchadas via `OffscreenCanvas` → JPEG base64
5. Fallback: `captureVisibleTab()` se content script não responde (página restrita ou aba pré-existente)
6. Thumbnail do screenshot exibido no ScanningState com spinner overlay + "Analysing with Parts iQ..."

### Modo Crop (`handleCrop`)

1. Background recebe `take_crop_init`
2. Tenta `ping` ao content script; se falhar → injeta automaticamente via `chrome.scripting.executeScript` (lê path do `chrome.runtime.getManifest()`)
3. Content script mostra **crop hint animation** na página (~2.5s): cursor se move e desenha seleção com `requestAnimationFrame`. Clicar pula a animação.
4. Após animação → injeta `cropOverlay` (fullscreen crosshair)
5. Usuário arrasta → content script envia `crop_done` com `{ rect, dpr }` ao background
6. Background captura `captureVisibleTab` + recorta via `OffscreenCanvas`
7. Envia `crop_ready` ao sidebar → `setState('scanning')` → processa

**Nota:** O sidebar **não muda de estado** enquanto o usuário faz a seleção. Só vai para `scanning` ao receber `crop_ready`.

### Proxy AI (Bubble)

```
POST https://app.parts-iq.com/version-138bg/api/1.1/wf/ai_extract
credentials: 'include'
Content-Type: application/json
{ "image_base64": "...", "prompt": "..." }
```

A chave do OpenRouter fica **exclusivamente no Bubble** (server-side). A extensão nunca a vê.

**Modelo:** `google/gemini-2.0-flash-001` (configurado no Bubble via API Connector OpenRouter)

**Bubble backend workflow `ai_extract`:**
- Parâmetros: `image_base64` (text), `prompt` (text)
- Step 1: chama OpenRouter Chat Completion
- Step 2: Return data — `parts` (text) = `Step 1's choices:first item's message content`
- API Connector inicializado via "Manually enter API response" (não "Initialize call" — imagem placeholder causa erro 400 no Gemini)

**Resposta do Bubble:**
```json
{ "status": "success", "response": { "parts": "```json\n[...]\n```" } }
```

**Parse em `ai.ts`:**
1. Lê `data.response.parts` (fallback: `data.parts`)
2. Extrai content do OpenRouter se vier como raw body: `choices[0].message.content`
3. Strip markdown code fences (` ```json `)
4. `JSON.parse` → array de peças

**Pós-scan:**
- **≥1 peças** → merge no carrinho → vai para `cart`
- **0 peças** → vai para `fallback`
- **Erro de rede** → mostra erro com botão "Retry"

### Re-scan (URL mudou)

Content script detecta mudança de URL → envia `url_changed` → background relay → sidebar mostra banner: *"Page changed — scan now?"*

Ao confirmar scan → aplica **regra de merge**:

| Peça no carrinho | `sourceUrl` === URL atual? | Ação |
|---|---|---|
| `pending` ou `error` | sim | Remove (substituída pelas novas) |
| `sent` | sim | Preserva |
| qualquer status | não | Preserva |

---

## Design System

Baseado no Bubble design system do PartsIQ:

| Token | Valor |
|-------|-------|
| Primary | `#00C6B2` |
| Primary text | `#473150` |
| Primary light (shadow/bg) | `#B3EEE6` |
| Label / body | `#525252` |
| Border | `#E6E6E6` |
| Background | `#FFFFFF` |

**Button Primary:** `bg-[#00C6B2] text-[#473150] font-semibold rounded-full hover:opacity-90`

**Button Outline:** `bg-white border border-[#E6E6E6] text-[#525252] font-normal rounded-full hover:bg-gray-50`

---

## Carrinho (CartState)

### Layout

```
┌─────────────────────────────┐
│ [badge: KCV-1235] [Change]  │  ← border #E6E6E6, texto #525252, change em #00C6B2
├─────────────────────────────┤
│ ☐ Filtro de óleo — €12,50  │  ← checkbox accent #00C6B2, nome #525252
│   Part number: 06J115403 ✏️ │
│   moco.nl  · 2d        [✕] │
│                             │
│ ☑ Vela NGK — €8,00  ✓ Sent │  ← "Sent" em #00C6B2
│   Part number: 4629         │
│   autodoc.com  · 1d         │
│─────────────────────────────│
│  [+ Add part manually]      │  ← texto #00C6B2
├─────────────────────────────┤
│  [Crop]      [Scan page]    │  ← Crop=primary, Scan=outline
│  [Clear unsent]             │  ← outline, full width
│  [Finish search]            │  ← primary, full width
└─────────────────────────────┘
```

### Edição Inline do Part Number (✏️)

Disponível apenas para peças `pending` ou `error`. Peças `sent` sem lápis — desmarcar primeiro (→ `remove_part` → `pending`), depois editar.

### Comportamento do Checkbox

**Regra:** checkbox desabilitado se `oem` vazio.

| Ação | Status anterior | Chamada API | Resultado |
|------|----------------|-------------|-----------|
| Marcar ☑ | `pending` (com oem) | `POST save_part` | `sending` → `sent` |
| Desmarcar ☐ | `sent` | `POST remove_part` com `bubblePartId` | `sending` → `pending` |
| Marcar ☑ (retry) | `error` | `POST save_part` | `sending` → `sent` |

### Envio de Peça (`save_part`)

```
POST https://app.parts-iq.com/version-138bg/api/1.1/wf/save_part
credentials: 'include'
{
  "part_name": string,
  "oem_number": string,
  "net_price": number,              // mesmo valor que gross_price (extensão não tem gross)
  "gross_price": number,
  "delivery_time": string,          // deliveryDays convertido para string, ex: "3"
  "stock_available": boolean,       // stock > 0
  "supplier": string,
  "source_url": string,
  "work_mode": "vehicle" | "order",
  "autoflex_integration": "yes" | "no",  // "yes" se autoflex_connected no login
  "confidence": 90,
  "vehicle_id": string,             // se workMode = 'vehicle'
  "vehicle_plate": string,          // se workMode = 'vehicle'
  "order_id": string                // se workMode = 'order'
}
```

Retorna: `{ status: "success", response: { id: "bubble_part_id" } }`

**Nota:** `bubblePartId` lido em `data.response.id` (fallback: `data.id` → `data.bubble_part_id`). Necessário para o `remove_part`.

Peças enviadas **uma por uma** — facilita retry individual.

### Remoção de Peça (`remove_part`)

```
POST https://app.parts-iq.com/version-138bg/api/1.1/wf/remove_part
credentials: 'include'
{ "bubble_part_id": "..." }
```

### Adição Manual

Botão `[+ Add part manually]` abre formulário inline:
- Campos: Part name (required) + Part number
- Cria `CartItem` com `status: 'pending'`, `sourceUrl: ''`
- `setShowManualForm(false)` é chamado **antes** do `await onUpdateCart` para evitar stale ref no `e.currentTarget`

### Botão [✕] por Item

Remove do carrinho. Apenas para `pending` ou `error`.

### Botão "Clear unsent" (🗑)

Remove peças `pending` ou `error`. Pede confirmação: *"Remove X unsent parts?"*

### Finalizar Busca

- Limpa carrinho + vehicle/order do storage
- `lang` e `workMode` preservados
- Vai para `finish`

---

## FallbackState (0 peças encontradas)

```
┌─────────────────────────────┐
│  No parts found on this page│
│                             │
│  [Part name input]          │
│  [Part number input]        │
│  [Add part]                 │
│                             │
│  [📷 Scan page]             │
│  [✂️ Try with crop]         │
└─────────────────────────────┘
```

---

## FinishState

```
┌─────────────────────────────┐
│   ✓ Search finished.        │
│                             │
│   Check part status in      │
│   PartsIQ.                  │
│                             │
│   [New quote]               │
└─────────────────────────────┘
```

"New quote" → vai para `idle`.

---

## Edge Cases

| Situação | Comportamento |
|---|---|
| Scan em página restrita (chrome://, extensão) | Fallback `captureVisibleTab()` automático |
| Aba aberta antes da extensão ser carregada | `ping` falha → background injeta content script via `chrome.scripting.executeScript` |
| `remove_part` falha | Status volta para `sent`, erro inline |
| `ai_extract` falha | Erro no scan com botão "Retry" |
| URL muda durante `scanning` | Banner aguarda — não interrompe o scan |
| Sidebar fechado com peças `pending` | Carrinho persiste no storage |
| Abertura com veículo/ordem já selecionado | Vai direto para `cart` com contexto e carrinho do storage |
| Abertura sem veículo/ordem | Vai para `idle` → seleção normal |
| Abertura no dia seguinte | Cart é limpo automaticamente (cartDate != hoje) |
| Abertura da extensão | Sempre inicia `checking` — verifica sessão via Bubble (timeout 3s) |
| Sessão expirada | `checking` timeout → vai para `login` |

---

## Internacionalização

Idioma definido pelo campo `language` de `partsiq:login_success`. Sem troca manual.
Suportados: `'en'` (English) e `'nl'` (Nederlands).

---

## Ambiente: Desenvolvimento vs Live

> ⚠️ **Atualmente rodando em ambiente de desenvolvimento (version-138bg).**

### URLs de desenvolvimento (`constants.ts` atual)

```typescript
BUBBLE_BASE_URL: 'https://app.parts-iq.com/version-138bg'
BUBBLE_API.AI_EXTRACT:   'https://app.parts-iq.com/version-138bg/api/1.1/wf/ai_extract'
BUBBLE_API.SAVE_PART:    'https://app.parts-iq.com/version-138bg/api/1.1/wf/save_part'
BUBBLE_API.REMOVE_PART:  'https://app.parts-iq.com/version-138bg/api/1.1/wf/remove_part'
```

### Checklist para ir para Live

Alterar **somente** `src/lib/constants.ts`:

| Campo | Dev | Live |
|-------|-----|------|
| `BUBBLE_BASE_URL` | `.../version-138bg` | `https://app.parts-iq.com` |
| `BUBBLE_API.AI_EXTRACT` | `.../version-138bg/api/1.1/wf/ai_extract` | `.../api/1.1/wf/ai_extract` |
| `BUBBLE_API.SAVE_PART` | `.../version-138bg/api/1.1/wf/save_part` | `.../api/1.1/wf/save_part` |
| `BUBBLE_API.REMOVE_PART` | `.../version-138bg/api/1.1/wf/remove_part` | `.../api/1.1/wf/remove_part` |

`BUBBLE_ORIGIN` permanece `https://app.parts-iq.com` em ambos.

---

## Segurança

- Chave OpenRouter armazenada **exclusivamente no Bubble** (server-side)
- Extensão chama apenas `ai_extract` endpoint do Bubble
- Autenticação Bubble via cookies de sessão (`credentials: 'include'`)
- `<all_urls>` em `host_permissions` necessário para `captureVisibleTab` e `scripting.executeScript`
