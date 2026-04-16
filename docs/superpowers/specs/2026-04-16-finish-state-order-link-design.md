# Finish State Order Link — Design

## Goal

Na tela de conclusão de busca (`FinishState`), quando o fluxo é de ordem (Autoflex), o link "Check status" deve apontar para a página de peças sourced da ordem específica, incluindo o `work-order-id` na URL.

## Behavior

- **Modo ordem (`workMode === 'order'`):** link aponta para `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex//sourced-parts?work-order-id=${order.id}`
- **Modo veículo (`workMode === 'vehicle'`):** sem mudança — link continua apontando para `${CONFIG.BUBBLE_BASE_URL}/dash/parts`
- Se `order` for null no modo ordem (edge case improvável), fallback para `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex`

## Files Changed

| Arquivo | Mudança |
|---------|---------|
| `src/components/states/FinishState.tsx` | Adicionar prop `order: Order | null`, atualizar `dashUrl` para ordem |
| `src/pages/sidepanel/Sidebar.tsx` | Passar `order={order}` para `<FinishState>` |

## URL Note

`CONFIG.BUBBLE_BASE_URL` é o único ponto de controle para dev (`/version-138bg`) vs live. Nenhuma mudança adicional necessária ao migrar para live.
