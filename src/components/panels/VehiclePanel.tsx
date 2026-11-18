import type { Lang, Vehicle } from '@app-types/parts';
import { useT } from '@lib/i18n';
import PanelHeader from './PanelHeader';

interface Props {
  vehicle: Vehicle | null;
  lang: Lang;
  onExpand: () => void;
  /** Set only when an Autoflex work order is open: link back to its panel */
  onBackToWorkOrder?: () => void;
}

export default function VehiclePanel({ vehicle, lang, onExpand, onBackToWorkOrder }: Props) {
  const t = useT(lang);
  return (
    <PanelHeader
      plate={vehicle?.plate}
      changeLabel={t.changeVehicle}
      onChange={onExpand}
      backLabel={t.backToWorkOrder}
      onBack={onBackToWorkOrder}
    />
  );
}
