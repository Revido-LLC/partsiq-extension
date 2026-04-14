interface Props {
  children: React.ReactNode;
  compact?: boolean; // true = 40px header (for iframe states), false = 56px (default)
}

const PopupLayout = ({ children, compact = false }: Props) => {
  return (
    <div style={{ width: '468px', minHeight: '650px' }} className="flex flex-col bg-white">
      {/* Header */}
      <div className={`flex items-center px-4 bg-white border-b border-gray-100 flex-shrink-0 ${compact ? 'h-10' : 'h-14'}`}>
        <span className="font-semibold text-gray-900 text-sm tracking-tight">Parts iQ</span>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default PopupLayout;
