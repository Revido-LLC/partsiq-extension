# PartsIQ Chrome Extension — História do Estado Atual
**Data:** 2026-04-10
**Status:** Rascunho para revisão — edite este arquivo e peça ao Claude para ler a versão atualizada

---

## Visão Geral

A extensão PartsIQ é um Chrome sidebar (Manifest V3) usado por mecânicos para capturar dados de peças em sites de fornecedores via IA (screenshot + Gemini 2.0 Flash) e enviar essas peças ao backend PartsIQ (Bubble) para comparação de preços.

Stack: React 19 + TypeScript + Vite + TailwindCSS 4 + @crxjs/vite-plugin + OpenRouter + Bubble backend.

---

## Fluxo Principal (do ponto de vista do usuário)

### 1. Abertura

O mecânico está num site de fornecedor (ex: Molco, Parts 360). Ele clica no ícone da extensão na barra do Chrome. O sidebar abre.

### 2. Autenticação

O sidebar exibe um spinner enquanto carrega silenciosamente um iframe da página `/auth/` do Bubble. Essa página verifica a sessão via cookie:

- **Sessão válida:** Bubble emite `partsiq:login_success` com `userId`, `language` (`en` ou `nl`) e `autoflex_connected` (boolean). O spinner desaparece, o app avança.
- **Sessão expirada:** Bubble emite `partsiq:login_required` e o formulário de login do Bubble aparece no iframe. Após login, emite `partsiq:login_success`.
- **Timeout (5s sem resposta):** O formulário de login aparece como fallback.

Com base em `autoflex_connected`:
- `true` → modo `order` (fluxo Autoflex)
- `false` → modo `vehicle` (fluxo padrão)

O idioma detectado (`en` / `nl`) é salvo e usado em todos os labels da interface.

### 3. Seleção de Veículo ou Order

O sidebar mostra um iframe expandido da página `/extension` do Bubble.

- **Modo `vehicle`:** exibe seletor de veículos. Bubble emite `partsiq:vehicle_selected` com `plate` e `id`.
- **Modo `order`:** exibe pedidos Autoflex. Bubble emite `partsiq:order_selected` com `plate` e `id`.

Após seleção, o iframe colapsa para uma barra compacta (placa + botão "Trocar"). Se o carrinho estava vazio, o scan inicia automaticamente.

### 4. Scan de Página

O sidebar exibe "Analisando screenshot com PartsIQ..." com chip pulsante "SCANNING" e thumbnail da imagem capturada.

Por baixo dos panos:
1. Sidebar pede screenshot ao service worker (`take_screenshot`).
2. Service worker usa Chrome DevTools Protocol (CDP): anexa à aba, faz scroll da página inteira (lazy loading), volta ao topo, captura JPEG qualidade 90.
3. Screenshot (base64) enviada ao OpenRouter com modelo Gemini 2.0 Flash.
4. Gemini retorna JSON com array de peças: `partName`, `oemNumber`, `netPrice`, `grossPrice`, `deliveryTime`, `stock`, `supplier`, `confidence`.
5. App parseia, sanitiza (remove markdown fences se houver) e filtra itens inválidos.
6. **Peças encontradas:** vai ao carrinho. **Nenhuma peça:** retorna ao carrinho vazio.

### 5. Crop Manual (alternativa ao scan completo)

O usuário clica "Crop página". O sidebar entra em modo de espera. Um overlay escuro aparece sobre a página do fornecedor com animação tutorial (2.5s). O usuário arrasta para selecionar uma região.

- Seleção menor que 20×20px → ignorada, overlay permanece.
- Seleção válida → background captura apenas o viewport e corta via `OffscreenCanvas` → sidebar recebe imagem pré-cortada → entra no scan com essa imagem.

### 6. Carrinho

As peças extraídas aparecem como cards. Cada card mostra:
- Nome da peça
- Número OEM (editável inline com clique no ícone de lápis)
- Preço líquido e prazo de entrega
- Status: `pending` / `sending` (azul pulsante) / `sent` (verde) / `error` (vermelho + botão Retry)
- Aviso amarelo se confiança < 0.7
- Checkbox desabilitado se sem número OEM (tooltip explica)

**Ações disponíveis:**

- **Marcar checkbox:** envia peça ao Bubble via `POST /api/1.1/wf/save_part`. Item fica `sending` → `sent` (com `bubblePartId`) em sucesso, `error` em falha.
- **Desmarcar checkbox (item `sent`):** remove peça via `POST /api/1.1/wf/remove_part` usando `bubblePartId`. Item volta a `pending`.
- **Desmarcar checkbox (item `pending`):** apenas desmarca localmente, sem chamada de API.
- **Editar OEM:** clique no número ou "Sem número de peça" → campo de texto inline → Enter ou blur para salvar.
- **Adicionar manualmente:** botão no fim da lista abre formulário com nome e OEM obrigatórios. Itens manuais têm `confidence: 1.0`.
- **Limpar carrinho:** botão "Wissen / Clear" no footer.

Footer: `X geselecteerd · Y verzonden · Z onderdelen in lijst`

**Persistência:** O carrinho persiste no `chrome.storage.local` durante o dia corrente. Itens de dias anteriores são descartados automaticamente.

**URL changed:** Se a URL da aba mudar enquanto o usuário está no carrinho, um banner âmbar aparece: "Pagina gewijzigd — opnieuw scannen?" com botões "Sluiten" e "Scan pagina".

### 7. Finalizar

O usuário clica "Afronden / Finish". App limpa carrinho e veículo/order do storage. Tela final: checkmark verde + "Zoekactie voltooid / Search complete" + botão "Nieuwe zoekopdracht". Clicar nesse botão reseta para o carrinho vazio (VehiclePanel expande para nova seleção).

---

## Fluxo de Dados (sistema)

```
[Clique no ícone]
        │
        ▼
background → chrome.sidePanel.open() → sendMessage(sidebar_opened, 300ms)
        │
        ▼
Sidebar monta → isLoggedIn=false → LoginState
  → carrega storage: cart + vehicle + order + workMode + lang
        │
        ▼
LoginState → iframe /auth/ (cookie)
  → partsiq:login_success → setWorkMode + setLang → setIsLoggedIn(true)
        │
        ▼
isLoggedIn=true → setState('cart')
  → VehiclePanel → iframe /extension/
  → partsiq:vehicle_selected ou partsiq:order_selected
      → setVehicle/setOrder no storage
      → cart vazio? → setState('scanning')
        │
        ▼
ScanningState → take_screenshot (CDP) → OpenRouter/Gemini
  → peças → handlePartsFound → merge+dedup → setState('cart')
  → vazio → setState('cart')
        │
        ▼
CartPartCard: checkbox marcado
  → sendPartToBubble → POST /wf/save_part
      → sucesso: status='sent', bubblePartId salvo
      → falha: status='error'

CartPartCard: checkbox desmarcado (sent)
  → removePartFromBubble → POST /wf/remove_part
      → sucesso: status='pending'

Afronden → clearCart + clearVehicle/Order → setState('done')
```

---

## Modo Autoflex (order) vs. Modo Padrão (vehicle)

| Aspecto | Modo vehicle | Modo order (Autoflex) |
|---|---|---|
| Trigger | `autoflex_connected: false` | `autoflex_connected: true` |
| Iframe /extension/ mostra | Seletor de veículos | Lista de orders Autoflex |
| Evento Bubble | `partsiq:vehicle_selected` | `partsiq:order_selected` |
| Campo enviado ao Bubble | `vehicle_id` | `order_id` |
| Label do botão "Trocar" | "Trocar auto" | "Trocar order" |

---

## Workflows Bubble Necessários

### `save_part` — `POST /api/1.1/wf/save_part`

Payload:
```json
{
  "part_name": "string",
  "oem_number": "string",
  "net_price": number,
  "gross_price": number,
  "delivery_time": "string",
  "stock": "string",
  "supplier": "string",
  "confidence": number,
  "source_url": "string",
  "vehicle_id": "string",
  "order_id": "string"
}
```
Resposta esperada: `{ "response": { "part_id": "string" } }`

### `remove_part` — `POST /api/1.1/wf/remove_part`

Payload:
```json
{
  "part_id": "string"
}
```

Autenticação: cookie de sessão (`credentials: 'include'`), sem API key.

---

## Bugs e Problemas Conhecidos

### Críticos (bloqueiam o fluxo principal)

| # | Problema | Impacto |
|---|---|---|
| 1 | **Workflows Bubble não existem** (`save_part`, `remove_part`) | Toda marcação de peça falha com erro HTTP. O fluxo principal nunca completa. |

### Médios (prejudicam a experiência)

| # | Problema | Impacto |
|---|---|---|
| 2 | **`manifest.dev.json` referencia popup deletado** (`src/pages/popup/index.html`) | Build dev quebrada. |
| 3 | **`FallbackState.tsx` é código morto** | Componente nunca renderizado. Usuário sem feedback adequado quando scan não encontra peças. Sem suporte a tradução NL. |
| 4 | **Tooltip de OEM hardcoded em inglês** ("Add a part number to select this part") | Usuários NL veem inglês nesse texto. |

### Menores (técnicos)

| # | Problema | Impacto |
|---|---|---|
| 5 | **`buildBubbleUrl`** aceita `'parts'` e `'session'` como tipos válidos (TypeScript) | Geraria URL inválida em runtime se usados. Código atual não usa, mas é risco latente. |
| 6 | **Race condition em toggle rápido** de múltiplos checkboxes (stale closure de `cart`) | Decisões sobre status de item com estado desatualizado em cliques muito rápidos. |
| 7 | **`setTimeout(100ms)`** no auto-scan após seleção de veículo | Workaround de timing. Risco teórico de setar estado em componente desmontado. |
| 8 | **Redirect de iframe em `LoginState`** após `login_success` | Código morto — iframe é desmontado antes do redirect ter efeito. |

---

## O que NÃO está implementado / fora de escopo atual

- Firefox build (vite.config.firefox.ts existe mas não é usado ativamente)
- Qualquer integração além de Autoflex
- Notificações push ou sincronização em tempo real
- Dashboard ou histórico de buscas dentro da extensão

---

## Arquivos Principais

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/sidepanel/Sidebar.tsx` | Máquina de estados central |
| `src/background/index.ts` | Service worker: sidePanel, CDP, crop |
| `src/content/index.ts` | URL tracking + bridge do overlay |
| `src/content/crop-overlay.ts` | Overlay de crop DOM |
| `src/lib/ai.ts` | Chamada OpenRouter/Gemini |
| `src/lib/bubble-api.ts` | save_part / remove_part |
| `src/lib/storage.ts` | chrome.storage.local |
| `src/lib/iframe.ts` | buildBubbleUrl + useBubbleMessages |
| `src/components/VehiclePanel.tsx` | Iframe /extension/ + seleção |
| `src/components/states/LoginState.tsx` | Iframe /auth/ + autenticação |
| `src/components/states/ScanningState.tsx` | UI de scan + chamada IA |
| `src/components/states/FallbackState.tsx` | **ÓRFÃO** — não conectado |
| `src/components/cart/CartPartCard.tsx` | Card de peça no carrinho |
| `src/lib/translations.ts` | Dicionário EN/NL |

---

## Notas de Build

```bash
cd C:\Users\Fillipe\partsiq-extension
yarn build:chrome   # → dist_chrome/
```

Após rebuild, recarregar em `chrome://extensions`.
