import type { ReactNode } from 'react';

interface Props {
  vehiclePanel?: ReactNode;
  vehiclePanelExpanded?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

const SidebarLayout = ({ vehiclePanel, vehiclePanelExpanded, footer, children }: Props) => {
  return (
    <div className="flex flex-col h-screen w-full bg-white">

      {/* Vehicle panel — expands to fill remaining space or stays compact */}
      {vehiclePanel && (
        <div className={vehiclePanelExpanded ? 'flex-1 min-h-0 flex flex-col border-b border-gray-100' : 'flex-shrink-0 border-b border-gray-100'}>
          {vehiclePanel}
        </div>
      )}

      {/* Scrollable content — hidden when vehicle panel is full-screen */}
      {!vehiclePanelExpanded && (
        <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {children}
        </main>
      )}

      {/* Sticky footer — hidden when vehicle panel is full-screen */}
      {!vehiclePanelExpanded && footer && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-white">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SidebarLayout;
