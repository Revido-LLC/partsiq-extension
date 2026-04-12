# PartsIQ Extension — Sidepanel Design Spec

> **Status:** Implemented
> **Date:** 2026-04-10
> **Updated:** 2026-04-12
> **Approach:** Clean rewrite — sidepanel UI from scratch, reusing background.ts / storage.ts / ai.ts utilities

---

## O que é o PartsIQ

Extensão Chrome usada por **mecânicos** enquanto navegam em sites de fornecedores de peças automotivas. Com um clique, captura um screenshot da página atual, envia para um modelo de visão via Bubble proxy, e extrai automaticamente dados das peças: nome, part number, preço, prazo de entrega, estoque, fornecedor.

As peças extraídas vão para um carrinho no sidebar. O mecânico confere, marca as que quer, e elas são salvas no Bubble associadas ao veículo ou ordem selecionada.

---

## Paradigma de UI

**Sidebar apenas.** O popup foi descontinuado.

- `manifest.json`: remove `default_popup`, adiciona `side_panel` permission + `sidePanel` entry
- `host_permissions`: `["https://app.parts-iq.com/*"]`
- O ícone da extensão na barra do Chrome abre o sidebar via `chrome.sidePanel.open()` no background

---

## Estrutura de Arquivos

```
src/
├── background/index.ts          # service worker: screenshot CDP, relay URL, abre sidebar
├── content/index.ts             # detecta mudança de URL, crop overlay
├── pages/
│   └── sidepanel/
│       ├── index.html
│       ├── index.tsx            # mount React
│       └── Sidebar.tsx          # máquina de estados principal
├── components/
│   ├── panels/
│   │   ├── VehiclePanel.tsx     # badge compacta + iframe /extension (fluxo veículo)
│   │   └── OrderPanel.tsx       # badge compacta + iframe /extension (fluxo ordem)
│   └── states/
│       ├── LoginState.tsx       # iframe /auth/log-in
│       ├── ScanningState.tsx    # screenshot + chamada Bubble proxy + progresso
│       ├── CartState.tsx        # lista de peças + checkbox send/unsend + manual add
│       ├── FallbackState.tsx    # 0 peças encontradas — input manual ou crop
│       └── FinishState.tsx      # confirmação de busca finalizada
├── lib/
│   ├── iframe.ts                # buildBubbleUrl, useBubbleMessages
│   ├── storage.ts               # cart, authStatus, vehicle, order, lang, workMode
│   ├── ai.ts                    # chama Bubble proxy (não OpenRouter direto)
│   └── constants.ts             # BUBBLE_BASE_URL, endpoints
└── types/parts.ts               # PartData, SidebarState, WorkMode, Lang
```

---

## Máquina de Estados

```
checking → login → idle → scanning → cart → finish
                              │        ↑       ↓
                              │    (re-scan)  (nova cotação → idle)
                              ↓
                           fallback → cart
```

| Estado | Descrição |
|--------|-----------|
| `checking` | Spinner + iframe oculto `/auth/log-in?source=extension`. Timeout 3s → `login` |
| `login` | iframe `/auth/log-in?source=extension` fullscreen. Aguarda `partsiq:login_success` |
| `idle` | VehiclePanel ou OrderPanel expandido. Aguarda seleção |
| `scanning` | Captura screenshot + chama proxy + mostra progresso |
| `cart` | Lista de peças. Re-scan disponível. Botão Finalizar |
| `fallback` | 0 peças encontradas. Input manual ou crop |
| `finish` | Confirmação. Botão "Nova cotação" → volta para `idle` |

---

## Protocolo de Mensagens

### Bubble → Extensão (`postMessage` via iframe)

| Tipo | Payload | Ação |
|------|---------|------|
| `partsiq:login_success` | `{ userId, language, autoflex_connected }` | salva auth, define `workMode` + `lang`, vai para `idle` |
| `partsiq:login_required` | — | mantém em `login` (iframe mostra formulário) |
| `partsiq:login_failed` | — | mostra erro abaixo do iframe |
| `partsiq:vehicle_selected` | `{ plate, id }` | salva veículo, recolhe VehiclePanel, vai para `scanning` |
| `partsiq:order_selected` | `{ plate, id }` | salva ordem, recolhe OrderPanel, vai para `scanning` |

### Extensão → Background (`chrome.runtime.sendMessage`)

| Tipo | Payload | Resposta |
|------|---------|----------|
| `take_screenshot` | — | `{ imageBase64 }` JPEG |
| `take_crop` | `{ rect }` | `{ imageBase64 }` região recortada |
| `url_changed` | `{ url }` | — (relay do content script) |

---

## Storage Local (`chrome.storage.local`)

```typescript
{
  authStatus: boolean,
  userId: string,
  lang: 'en' | 'nl',
  workMode: 'vehicle' | 'order',
  vehicle: { plate: string, id: string } | null,
  order: { plate: string, id: string } | null,
  cart: PartData[],
  cartDate: string,   // 'YYYY-MM-DD' — limpa automaticamente se dia diferente
}
```

---

## Tipos Centrais

```typescript
type Lang = 'en' | 'nl';
type WorkMode = 'vehicle' | 'order';
type SidebarState = 'checking' | 'login' | 'idle' | 'scanning' | 'cart' | 'fallback' | 'finish';

type PartData = {
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
3. Se recebido → transita para `idle` (sessão válida)
4. Se **3 segundos** passam sem resposta → `authStatus = false` → transita para `login`

**LoginState** renderiza iframe fullscreen com 10px de margem lateral apontando para `/auth/log-in?source=extension`. Sem rodapé de erro — o Bubble exibe feedback de login nativo.

- `partsiq:login_success` recebido:
  - `lang` define idioma da UI (`'en'` | `'nl'`) — sem opção de troca na extensão
  - `autoflex_connected === 'yes'` → `workMode = 'order'` → mostra OrderPanel
  - `autoflex_connected === 'no'` → `workMode = 'vehicle'` → mostra VehiclePanel
  - Salva `userId` no storage

**Nota Bubble:** O workflow "User is logged in" roda apenas quando `?source=extension` está na URL. O `postMessage` é enviado diretamente no script JS (sem `param1`) com `autoflex_connected` como dado dinâmico inline.

---

## Fluxo de Seleção (Idle)

### VehiclePanel (`workMode = 'vehicle'`)

- **Expandido**: iframe fullscreen para `/extension` no Bubble — busca veículo pela placa
- Bubble envia `partsiq:vehicle_selected` com `{ plate, id }`
- Painel recolhe para badge compacta: `"HJK-03-D"` com botão "Trocar veículo"
- Sidebar transita para `scanning`

### OrderPanel (`workMode = 'order'`)

- **Expandido**: iframe fullscreen para `/extension` no Bubble — busca ordem Autoflex pela placa
- Bubble envia `partsiq:order_selected` com `{ plate, id }`
- Painel recolhe para badge compacta com botão "Trocar ordem"
- Sidebar transita para `scanning`

**Importante:** `useBubbleMessages` registrado em `Sidebar.tsx` (sempre ativo), não dentro dos painéis. Guarda por `isLoggedInRef.current` para evitar processar mensagens antes do login.

---

## Fluxo de Scan

### Screenshot Completo

1. Sidebar envia `take_screenshot` ao background
2. Background tenta `Page.captureScreenshot` via CDP com `captureBeyondViewport: true` (página inteira)
3. Fallback automático: `captureVisibleTab()` se página restrita (chrome://, extensões, etc.)
4. Retorna JPEG base64

### Modo Crop

1. Sidebar envia `start_crop` ao content script da aba ativa
2. Content script injeta overlay fullscreen com cursor crosshair
3. Usuário arrasta para selecionar região → content script envia `crop_selected` com `{ rect }`
4. Background recebe `take_crop` com `{ rect }`, captura screenshot e recorta via OffscreenCanvas
5. Retorna JPEG base64 da região

### Proxy AI (Bubble)

```
POST https://app.parts-iq.com/api/1.1/wf/ai_extract
credentials: 'include'
Content-Type: application/json
{ "image_base64": "...", "prompt": "..." }
```

A chave do OpenRouter fica **exclusivamente no Bubble** (server-side). A extensão nunca a vê.

**Modelo:** `google/gemini-2.0-flash-001` (configurado no Bubble via API Connector OpenRouter)

**Bubble backend workflow `ai_extract`:**
- Parâmetros: `image_base64` (text), `prompt` (text)
- Step 1: chama OpenRouter Chat Completion com `api_key` do Option Set `AppConfig` (option `openrouter_key`)
- Step 2: Return data — `parts` (text) = `Step 1's raw body text`
- A extensão recebe o body bruto do OpenRouter e extrai `choices[0].message.content`

**Resposta do Bubble:**
```json
{ "parts": "<raw OpenRouter JSON string>" }
```

**Parse em `ai.ts`:** extrai `choices[0].message.content` do body bruto → parseia como JSON array de peças.

**Pós-scan:**
- **≥1 peças** → aplica merge no carrinho → vai para `cart`
- **0 peças** → vai para `fallback`
- **Erro de rede** → mostra erro com botão "Tentar novamente"

### Re-scan (URL mudou)

Content script detecta mudança de URL → envia `url_changed` → sidebar mostra banner: *"Página mudou — escanear?"*

Ao confirmar → executa scan e aplica **regra de merge**:

| Peça no carrinho | `sourceUrl` === URL atual? | Ação |
|---|---|---|
| `pending` ou `error` | sim | Remove (substituída pelas novas) |
| `sent` | sim | Preserva |
| qualquer status | não | Preserva |

---

## Carrinho (CartState)

### Layout

```
┌─────────────────────────────┐
│ [badge: HJK-03-D] [Trocar]  │
├─────────────────────────────┤
│ ☐ Filtro de óleo — €12,50  │
│   Part number: 06J115403 ✏️ │
│   moco.nl  · 2 dias   [✕]  │  ← remove item do carrinho (pending/error only)
│                             │
│ ☑ Vela NGK — €8,00  ✓sent  │
│   Part number: 4629 ✏️      │
│   autodoc.com.br · 1 dia[✕] │
│─────────────────────────────│
│  [+ Adicionar peça manual]  │  ← expande inline ↓
│  Nome:  [______________]    │
│  P/N:   [______________]    │
│         [✕]  [Adicionar]    │
├─────────────────────────────┤
│  [📷 Scan] [✂️ Crop]        │
│  [🗑 Limpar não enviadas]   │
│  [Finalizar Busca]          │
└─────────────────────────────┘
```

### Terminologia por idioma

| Campo | EN | NL |
|-------|----|----|
| Part number | Part number | Artikelnummer |
| Supplier | Supplier | Leverancier |
| Delivery | Delivery time | Levertijd |
| Stock | Stock | Voorraad |
| Price | Price | Prijs |

### Edição Inline do Part Number (✏️)

Disponível **apenas para peças não enviadas** (`pending` ou `error`). Peças `sent` não exibem o ícone de lápis — o mecânico deve desmarcar o checkbox primeiro (que chama `remove_part` e volta para `pending`), e só então pode editar o part number.

Clicar no lápis substitui o texto por um input inline na mesma posição. Confirma com Enter ou blur. Quando `oem` é preenchido, o checkbox é habilitado automaticamente. O valor atualizado é enviado ao Bubble no momento do envio.

### Comportamento do Checkbox

**Regra:** checkbox fica **desabilitado** enquanto `oem` estiver vazio. O mecânico deve preencher o part number via edição inline antes de poder enviar.

| Ação | Status anterior | Chamada API | Resultado |
|------|----------------|-------------|-----------|
| Marcar ☑ | `pending` (com oem preenchido) | `POST save_part` | `sending` → `sent` |
| Desmarcar ☐ | `sent` | `POST remove_part` com `bubblePartId` | `sending` → `pending` |
| Marcar ☑ (retry) | `error` | `POST save_part` | `sending` → `sent` |

Peças `sent` voltam para `pending` após `remove_part` — podem ser reenviadas.

### Envio de Peça (`save_part`)

```
POST https://app.parts-iq.com/api/1.1/wf/save_part
credentials: 'include'
{
  name, oem, price, delivery_days, stock,
  supplier, source_url,
  vehicle_id,           // se workMode = 'vehicle'
  order_id,             // se workMode = 'order'
  work_mode: 'vehicle' | 'order'
}
```

Peças enviadas **uma por uma** — facilita retry individual.

### Remoção de Peça (`remove_part`)

```
POST https://app.parts-iq.com/api/1.1/wf/remove_part
credentials: 'include'
{ bubble_part_id: "..." }
```

Erro em `remove_part` → status volta para `sent`, mostra erro inline com retry.

### Adição Manual

Botão `[+ Adicionar peça manual]` na lista abre formulário inline (sem modal/popup):
- Campos: Nome da peça + Part number / Artikelnummer
- `[Adicionar]` → cria `PartData` com `status: 'pending'`, `sourceUrl: ''`
- Formulário fecha após adicionar; pode re-abrir para nova entrada

### Botão [✕] por Item

Remove o item individualmente do carrinho. Disponível apenas para peças com `status: 'pending'` ou `'error'`. Peças `sent` não têm botão `[✕]` — devem ser desmarcadas via checkbox (que chama `remove_part`).

### Botão "Limpar não enviadas" (🗑)

Remove peças com `status: 'pending'` ou `'error'`. Peças `sent` preservadas.
Confirmação antes: *"Remover X peças não enviadas?"*

### Finalizar Busca

- Limpa carrinho + vehicle/order
- `lang` e `workMode` são **preservados** (não mudam até novo login)
- Vai para `finish`

---

## FallbackState (0 peças encontradas)

```
┌─────────────────────────────┐
│  Nenhuma peça encontrada    │
│                             │
│  Part number / Artikelnummer│
│  [________________________] │
│                             │
│  [✂️ Tentar com crop]       │
│  [Adicionar manualmente]    │
└─────────────────────────────┘
```

- Input direto de part number → cria `PartData` manual → vai para `cart`
- "Tentar com crop" → ativa modo crop; se ≥1 peças encontradas → vai para `cart`; se 0 peças → permanece em `fallback` com mensagem de erro

---

## FinishState

```
┌─────────────────────────────┐
│                             │
│   ✓ Busca finalizada        │
│                             │
│   Verifique o status das    │
│   peças no PartsIQ.         │
│                             │
│   [Nova cotação]            │
│                             │
└─────────────────────────────┘
```

"Nova cotação" → vai para `idle` com VehiclePanel ou OrderPanel expandido.

---

## Persistência do Carrinho

- Salvo em `chrome.storage.local` a cada mudança
- Ao abrir o sidebar: compara `cartDate` com data atual (YYYY-MM-DD)
- Dia diferente → limpa carrinho silenciosamente, sem aviso
- "Finalizar Busca" → limpa carrinho explicitamente

---

## Edge Cases

| Situação | Comportamento |
|---|---|
| Sidebar aberto em dia diferente | Limpa carrinho silenciosamente ao iniciar |
| Scan em página restrita (chrome://, extensão) | Fallback `captureVisibleTab()` automático |
| `remove_part` falha | Status volta para `sent`, erro inline com retry |
| `ai_extract` falha | Erro no scan com botão "Tentar novamente" |
| URL muda durante `scanning` | Banner aguarda — não interrompe o scan |
| Sidebar fechado com peças `pending` | Carrinho persiste no storage (mesmo dia) |
| Abertura da extensão | Sempre inicia `checking` — verifica sessão via Bubble (timeout 3s) |
| Sessão expirada (logout pelo Bubble) | `checking` timeout → vai para `login` |

---

## Internacionalização

Idioma definido exclusivamente pelo campo `language` vindo de `partsiq:login_success`.
Sem opção de troca manual na extensão.
Idiomas suportados: `'en'` (English) e `'nl'` (Nederlands).

---

## Segurança

- Chave OpenRouter armazenada **exclusivamente no Bubble** (server-side)
- Extensão nunca vê a chave — chama apenas `ai_extract` endpoint do Bubble
- Autenticação Bubble via cookies de sessão (`credentials: 'include'`)
- `host_permissions: ["https://app.parts-iq.com/*"]` no manifest
