import type { Lang, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import PanelHeader from './PanelHeader';

interface Props {
  order: Order | null;
  lang: Lang;
  onExpand: () => void;
  /** Set only when an Autoflex work order is open: link back to its panel */
  onBackToWorkOrder?: () => void;
}

export default function OrderPanel({ order, lang, onExpand, onBackToWorkOrder }: Props) {
  const t = useT(lang);
  return (
    <PanelHeader
      plate={order?.plate}
      changeLabel={t.changeOrder}
      onChange={onExpand}
      backLabel={t.backToWorkOrder}
      onBack={onBackToWorkOrder}
    />
  );
}
