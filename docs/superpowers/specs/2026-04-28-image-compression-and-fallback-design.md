# PartsIQ — Image Compression & FallbackState Redesign

> **Status:** Approved
> **Date:** 2026-04-28
> **Problem:** Scan e crop falham com `TimeoutError: signal timed out` porque as imagens enviadas ao Gemini via Bubble são grandes demais (1–2MB base64). O FallbackState exibia um botão Retry que sempre fazia scan completo, ignorando o fluxo original do usuário.

---

## Contexto

### Root Cause

`screenshot.ts` capta até 8 viewports e os junta num `OffscreenCanvas`, podendo gerar imagens de até 1280×6400px. Telas com DPR 2x (retina) também produzem crops grandes mesmo com área pequena selecionada. A imagem base64 resultante ultrapassa o limite que o Google Gemini (via OpenRouter) consegue processar em 30 segundos, causando `TimeoutError` no cliente e 504 no Bubble.

### Fluxos afetados

| Fluxo | Entrada de imagem | Problema |
|-------|-------------------|---------|
| Scan page | `captureScreenshot()` → até 8 viewports stitchados | Imagem muito grande |
| Crop | background `captureVisibleTab` + recorte pelo rect selecionado | DPR 2x pode gerar imagem grande |

---

## Design

### 1 — Nova função `compressImage` em `image-utils.ts`

```typescript
async function compressImage(
  dataUrl: string,
  maxSide: number,
  quality: number
): Promise<string>
```

**Comportamento:**
1. Converte `dataUrl` para `Blob` via `dataUrlToBlob` (já existente)
2. Cria `ImageBitmap` do blob
3. Calcula escala: `scale = Math.min(1, maxSide / Math.max(width, height))`
4. Desenha num `OffscreenCanvas` com dimensões `width * scale` × `height * scale`
5. Converte para JPEG com a `quality` especificada via `canvas.convertToBlob`
6. Retorna nova `dataUrl`

**Parâmetros por fluxo:**

| Fluxo | maxSide | quality |
|-------|---------|---------|
| Scan page | 1400px | 0.72 |
| Crop | 1400px | 0.75 |

**Nota:** Se a imagem já for menor que `maxSide` em todos os lados, `scale = 1` e apenas a recompressão JPEG é aplicada.

---

### 2 — Compressão no Sidebar antes de `extractPartsFromScreenshot`

Em `Sidebar.tsx`, dois pontos de chamada:

**`handleScan`** (scan da página toda):
```
captureScreenshot()
  → compressImage(dataUrl, 1400, 0.72)
  → extractPartsFromScreenshot(compressedBase64)
```

**`handleCropReady`** (ao receber `crop_ready` do background):
```
imageBase64 recebido
  → compressImage(imageBase64, 1400, 0.75)
  → extractPartsFromScreenshot(compressedBase64)
```

O timeout em `ai.ts` permanece **30 segundos** sem alteração.

---

### 3 — FallbackState redesenhado

**Problema atual:** FallbackState exibia botão "Retry" que sempre chamava `handleScan` (scan completo), ignorando se o fluxo original foi crop.

**Solução:** Remover o botão Retry. Exibir os mesmos controles do cabeçalho do CartState:

| Elemento | Ação |
|----------|------|
| Botão **Scan** | Chama `handleScan` — scan completo da página |
| Botão **Crop** | Chama `handleCrop` — abre seleção de área |
| Botão **Finish / Clear** | Limpa estado → volta para `idle` (usuário pode trocar veículo/ordem) |

**Vantagem:** Zero estado extra no Sidebar (`lastScanMode`, `lastImageBase64` não são necessários). O usuário escolhe o próximo passo. Os handlers já existem.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/image-utils.ts` | Adiciona `compressImage` (exportada) |
| `src/lib/image-utils.test.ts` | Testes para `compressImage` |
| `src/pages/sidepanel/Sidebar.tsx` | Chama `compressImage` em `handleScan` e `handleCropReady` |
| `src/components/states/FallbackState.tsx` | Remove botão Retry, adiciona Scan + Crop + Finish/Clear |

**Não muda:** `ai.ts` (timeout 30s inalterado), `screenshot.ts`, `background/index.ts`.

---

## Critérios de sucesso

- Scan de página com 8 viewports completa em menos de 30s
- Crop em tela retina (DPR 2x) completa em menos de 30s
- FallbackState não tem mais botão Retry
- FallbackState oferece Scan, Crop e Finish/Clear
- Nenhum estado adicional no Sidebar
