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
| State machine | Popup.tsx + 7 state components | ✅ |
| Repositório | https://github.com/Revido-LLC/partsiq-extension | ✅ |

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

1. **Definir domínio Bubble** → atualizar `BUBBLE_BASE_URL` em `src/lib/constants.ts`
2. **Criar as 3 páginas no Bubble** (acima)
3. **Testar extensão localmente:**
   - `yarn build:chrome`
   - `chrome://extensions` → Developer mode → Load unpacked → selecionar `dist_chrome/`
   - Clicar no ícone → engrenagem → inserir chave OpenRouter
4. **Testar fluxo completo:**
   - Login via iframe Bubble
   - Capturar screenshot em site de peças
   - Verificar extração via AI
   - Confirmar que peças chegam na página `/ext-parts`
5. **Testar nos sites-alvo:** Molco, Parts 360, WM Parts, LKQ, RA Parts, Bright Motive, PartsLink24

---

## Arquitetura resumida

```
Mechanic abre popup
  → não logado? → LoginState (iframe /ext-login) → postMessage login_success
  → logado + idle → botão "Capture parts"
      → SessionState (iframe /ext-session) → escolhe/cria sessão
      → ScanningState → screenshot → OpenRouter AI → extrai peças JSON
          → peças encontradas → IframeState (iframe /ext-parts, peças via URL ou postMessage)
          → não encontrado → FallbackState (input manual)
      → partsiq:parts_saved → ConfirmState → "Open PartsIQ" / "Add more" / "Close"
```

**Comunicação com Bubble:** 100% via iframe + URL params + postMessage. Zero chamadas de API direta.
