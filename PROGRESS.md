# PartsIQ Extension — Progresso e Próximos Passos

## O que foi feito (extensão Chrome — 100% pronta)

Todo o código da extensão está implementado e buildando limpo (`yarn build:chrome`).

| Módulo | Arquivo | Status |
|---|---|---|
| Scaffold | manifest.json, vite configs, tsconfig, package.json | ✅ |
| Tipos TypeScript | `src/types/parts.ts` | ✅ |
| Configuração | `src/lib/constants.ts` | ✅ |
| Storage | `src/lib/storage.ts` | ✅ |
| Screenshot | `src/lib/screenshot.ts` | ✅ |
| AI (OpenRouter) | `src/lib/ai.ts` | ✅ |
| Iframe/postMessage | `src/lib/iframe.ts` | ✅ |
| Service Worker | `src/background/index.ts` | ✅ |
| Content Script | `src/content/index.ts` | ✅ |
| Sidebar state machine | `src/pages/sidepanel/Sidebar.tsx` | ✅ |
| VehiclePanel | `src/components/VehiclePanel.tsx` | ✅ |
| CartPartCard | `src/components/cart/CartPartCard.tsx` | ✅ |
| CartFooter | `src/components/cart/CartFooter.tsx` | ✅ |
| LoginState | `src/components/states/LoginState.tsx` | ✅ |
| ScanningState | `src/components/states/ScanningState.tsx` | ✅ |
| FallbackState | `src/components/states/FallbackState.tsx` | ✅ |
| Repositório | https://github.com/Revido-LLC/partsiq-extension | ✅ |

---

## Alterações recentes (sessão 2026-04-06)

### Refatoração completa — remoção de sessões, foco no veículo

**Motivação:** O modelo de "sessão de cotação" foi substituído pelo veículo como unidade de trabalho. O popup foi descontinuado. O sidebar é o único modo de uso.

**Mudanças:**

- **`manifest.json`:** Adicionado `host_permissions: ["https://app.parts-iq.com/*"]` — necessário para que `credentials: 'include'` funcione nas chamadas REST para o Bubble.
- **`src/types/parts.ts`:** Removidos `Session`, `PopupState`, e todos os message types de sessão. `SidebarState` ganhou o estado `'done'` (após Finalizar Busca).
- **`src/lib/constants.ts`:** Removidas chaves `session`, `parts` e `ACTIVE_SESSION`. Removido `MAX_URL_PARAM_LENGTH`.
- **`src/lib/storage.ts`:** Removidas funções de sessão (`getActiveSession`, `setActiveSession`). Expiração do carrinho mudou de 24h para **dia corrente** — itens de dias anteriores são descartados na leitura.
- **`src/lib/bubble-api.ts`:** `sendPartToBubble` não recebe mais `session_id`. Agora recebe `vehicle: Vehicle` (com `plate` e `id`) e `sourceUrl`.
- **`src/pages/sidepanel/Sidebar.tsx`:** Removida toda lógica de sessão. Veículo é obrigatório — sem veículo o scan é bloqueado e o VehiclePanel fica expandido. Auto-scan após selecionar veículo (se carrinho vazio). Novo handler `handleFinish` para o botão Finalizar Busca. Tela `'done'` com mensagem e botão "Nova busca".
- **`src/components/SidebarLayout.tsx`:** Removida dependência de `Session`/`SessionBadge`. Header agora exibe badge com placa do veículo.
- **`src/components/cart/CartFooter.tsx`:** Adicionado botão "Finalizar" (verde) que chama `onFinish`.
- **`src/components/states/ScanningState.tsx`:** Removida prop `session`.
- **Deletados:** `src/pages/popup/` (inteiro), `SessionState.tsx`, `IframeState.tsx`, `ConfirmState.tsx`, `IdleState.tsx`, `ResultsState.tsx`, `SessionBadge.tsx`.

---

## Alterações anteriores (sessão 2026-04-03)

### Auth verificada via Bubble a cada abertura

- `LoginState.tsx`: fase `'checking'` — carrega iframe `/auth/` em background, spinner enquanto aguarda resposta.
  - `partsiq:login_success` → vai direto ao UI principal
  - `partsiq:login_required` → exibe formulário
  - Sem resposta em 5s → fallback para formulário

---

## O que falta

### 1. Bubble — Workflow `save_part`

**Endpoint:** `POST /api/1.1/wf/save_part`
**Run as:** Logged-in user (usa cookie de sessão — sem API key)

Parâmetros recebidos:
| Campo | Tipo |
|-------|------|
| `part_name` | text |
| `oem_number` | text |
| `net_price` | number |
| `gross_price` | number |
| `delivery_time` | text |
| `stock_available` | yes/no |
| `supplier` | text |
| `vehicle_plate` | text |
| `vehicle_id` | text |
| `confidence` | number |
| `source_url` | text |

Ação: Create new Part com todos os campos acima.
Retorno: `{ "part_id": "<unique id do registro>" }`

### 2. Bubble — Workflow `remove_part`

**Endpoint:** `POST /api/1.1/wf/remove_part`
**Run as:** Logged-in user

| Campo | Tipo |
|-------|------|
| `part_id` | text |

Ação: Delete Part where unique id = `part_id`.
Retorno: 200 OK (sem body).

---

## Próximos passos (ordem recomendada)

1. **Criar os 2 workflows no Bubble** (ver acima) — próximo passo ativo
2. **Testar fluxo completo:**
   - Abrir sidebar → login via iframe `/auth/`
   - Selecionar veículo via iframe `/extension`
   - Capturar screenshot em site de peças
   - Verificar extração via AI
   - Marcar peças → confirmar que chegam no Bubble
   - Desmarcar → confirmar que são removidas
   - Clicar "Finalizar Busca" → confirmar clear + reset de veículo
3. **Testar nos sites-alvo:** Molco, Parts 360, WM Parts, LKQ, RA Parts, Bright Motive, PartsLink24

---

## Arquitetura atual (sidebar)

```
Abrir sidebar
  → não logado? → LoginState (iframe /auth/) → partsiq:login_success
  → logado + sem veículo → VehiclePanel expandido (iframe /extension/)
      → partsiq:vehicle_selected → badge placa no header
  → logado + com veículo → cart state
      → Re-scan → ScanningState → screenshot → GPT-4o → CartItems
      → não encontrado → FallbackState (entrada manual)
  → marcar peça → POST /wf/save_part (cookie) → status: sent
  → desmarcar → POST /wf/remove_part → status: pending
  → Finalizar Busca → clear cart + zera veículo + tela "done"
```
