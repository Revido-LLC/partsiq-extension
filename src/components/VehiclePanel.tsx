import { useState } from 'react';
import { buildBubbleUrl } from '@lib/iframe';
import type { Vehicle, Order, WorkMode } from '@types/parts';
import { T, type Lang } from '@lib/translations';

interface Props {
  vehicle: Vehicle | null;
  order: Order | null;
  workMode: WorkMode;
  expanded: boolean;
  lang: Lang;
  onExpand: () => void;
}

const VehiclePanel = ({
  vehicle,
  order,
  workMode,
  expanded,
  lang,
  onExpand,
}: Props) => {
  const [iframeKey, setIframeKey] = useState(0);
  const t = T[lang];

  const handleExpand = () => {
    setIframeKey(k => k + 1); // force Bubble page reload on each re-open
    onExpand();
  };

  // Determine active plate and label for compact mode
  const activePlate = workMode === 'order' ? order?.plate : vehicle?.plate;
  const hasSelection = workMode === 'order' ? !!order : !!vehicle;
  const changeLabel = workMode === 'order' ? t.changeOrder : t.changeCar;

  // Compact: selection made and panel is collapsed
  if (hasSelection && !expanded) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M5 11h14M4 15h16M7 19h10M3 11l2-4h14l2 4" />
          </svg>
          <span className="text-sm font-medium text-blue-800 tracking-wide">{activePlate}</span>
        </div>
        <button
          onClick={handleExpand}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {changeLabel}
        </button>
      </div>
    );
  }

  // Expanded: iframe fills available area
  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {hasSelection && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500">
            {workMode === 'order' ? t.selectOrder : t.selectVehicle}
          </span>
          <button
            onClick={handleExpand}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t.cancel}
          </button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <iframe
          key={iframeKey}
          src={buildBubbleUrl('vehicle', { source: 'extension' })}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="PartsIQ Vehicle / Order"
        />
      </div>
    </div>
  );
};

export default VehiclePanel;
