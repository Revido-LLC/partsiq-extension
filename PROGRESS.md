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
| Componentes compartilhados | StatusChip, SessionBadge, BubbleIframe, PopupLayout | ✅ |
| State machine | Popup.tsx + 8 state components | ✅ |
| Repositório | https://github.com/Revido-LLC/partsiq-extension | ✅ |

---

## Alterações recentes (sessão 2025-04-02)

### Bugs corrigidos

#### 1. `fetch(dataUrl)` falha em service workers MV3 — `src/background/index.ts`
**Problema:** Ao tentar capturar a página inteira (múltiplas capturas + stitch), o código usava `fetch(dataUrl)` para converter data URLs em Blobs. `fetch()` com data URLs não funciona em service workers MV3 do Chrome.
**Correção:** Substituído por conversão manual via `atob()` + `Uint8Array`.

#### 2. "no response from background service worker" era enganoso — `src/lib/screenshot.ts`
**Problema:** O background enviava `{ error: "mensagem real" }` mas o popup só checava `!response.screenshot`, exibindo sempre a mensagem genérica.
**Correção:** `throw new Error(response?.error ?? 'Screenshot capture failed...')` — agora exibe o erro real.

#### 3. Content script não injetado em abas pré-existentes — `src/background/index.ts`
**Problema:** `get_page_info` falhava com "Could not establish connection" quando a aba foi aberta antes de recarregar a extensão.
**Correção:** `try/catch` ao redor de `get_page_info` — se falhar, faz fallback para captura simples (apenas viewport visível).

#### 4. `null` como windowId em `captureVisibleTab` — `src/background/index.ts`
**Problema:** `captureVisibleTab(null as unknown as number, ...)` era um hack TypeScript. Usa-se agora `tab.windowId`.

#### 5. AI retornava JSON em markdown code fences — `src/lib/ai.ts`
**Problema:** A IA retornava a resposta dentro de ` ```json ... ``` `, causando falha no `JSON.parse`.
**Correção:** Strip das fences antes do parse: `content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')`.

### Nova funcionalidade

#### `ResultsState` — `src/components/states/ResultsState.tsx`
**Por quê:** `IframeState` carregava a página Bubble `/ext-parts` que ainda não existe, deixando a tela em branco após a extração.
**O que faz:** Exibe as peças extraídas diretamente no popup (nome, OEM, preços, fornecedor) com botão "Save to PartsIQ" que avança para o `IframeState` (integração Bubble futura).
**Fluxo atual:** `scanning` → `results` (exibe peças) → `iframe` (salva no Bubble quando pronto)

---

## O que falta

### 1. Definir o domínio Bubble real
Atualizar em `src/lib/constants.ts`:
```typescript
BUBBLE_BASE_URL: 'https://YOUR_BUBBLE_DOMAIN', // ← substituir aqui
```

### 2. Criar 3 páginas no Bubble (trabalho manual no Bubble editor)

#### `/ext-login`
- Formulário de login limpo (sem header, nav ou sidebar do Bubble)
- Ao fazer login com sucesso, disparar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:login_success', userId: '...' }, '*')
  ```
- Ao falhar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:login_failed', error: '...' }, '*')
  ```
- No carregamento da página, sempre disparar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:ready' }, '*')
  ```

#### `/ext-parts`
- Recebe peças via URL params (`?session_id=X&parts=<JSON>`) ou via postMessage `partsiq:set_parts`
- Exibe lista de peças com checkboxes (partName, oemNumber, netPrice, grossPrice, deliveryTime, stock)
- Seletor de carro (por placa) e vínculo com pedido
- Ao salvar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:parts_saved', count: N, sessionId: '...' }, '*')
  ```
- No carregamento: disparar `partsiq:ready`

#### `/ext-session`
- Criar nova sessão de coleta
- Listar sessões recentes com contagem de peças
- Selecionar sessão existente
- Ao criar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:session_created', sessionId: '...', name: '...' }, '*')
  ```
- Ao selecionar:
  ```javascript
  window.parent.postMessage({ type: 'partsiq:session_selected', sessionId: '...' }, '*')
  ```
- No carregamento: disparar `partsiq:ready`

**Todas as 3 páginas devem:**
- Usar layout sem header/nav/sidebar do Bubble (embed limpo)
- Disparar `partsiq:ready` ao carregar
- Escutar postMessages vindos da extensão

---

## Próximos passos (ordem recomendada)

1. **Criar as 3 páginas no Bubble** (ver protocolo acima) — próximo passo ativo
   - Começar por `/ext-parts` (fluxo principal)
   - Depois `/ext-session`
   - Depois `/ext-login`
2. **Confirmar tipos de dados no Bubble** — Thing `Part`/`Capture` com campos OEM, nome, preço net, preço bruto, fornecedor, sessão
3. **Definir domínio Bubble** → atualizar `BUBBLE_BASE_URL` em `src/lib/constants.ts` (ainda placeholder)
4. **Testar fluxo completo:**
   - Login via iframe Bubble
   - Capturar screenshot em site de peças
   - Verificar extração via AI
   - Selecionar peças no ResultsState
   - Confirmar que peças chegam na página `/ext-parts` via postMessage
5. **Testar nos sites-alvo:** Molco, Parts 360, WM Parts, LKQ, RA Parts, Bright Motive, PartsLink24

---

## Arquitetura resumida

```
Mechanic abre popup
  → não logado? → LoginState (iframe /ext-login) → postMessage login_success
  → logado + idle → botão "Capture parts"
      → SessionState (iframe /ext-session) → escolhe/cria sessão
      → ScanningState → screenshot → OpenRouter AI → extrai peças JSON
          → peças encontradas → ResultsState (cards com checkbox, copy OEM, badge confiança)
              → usuário seleciona peças → "Add to PartsIQ"
              → IframeState (iframe /ext-parts, peças via postMessage)
          → não encontrado → FallbackState (input manual)
      → partsiq:parts_saved → ConfirmState → "Open PartsIQ" / "Add more" / "Close"
```

**Comunicação com Bubble:** 100% via iframe + URL params + postMessage. Zero chamadas de API direta.
