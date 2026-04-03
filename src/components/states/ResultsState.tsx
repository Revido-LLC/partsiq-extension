import { useState } from 'react';
import type { PartData, Session } from '@types/parts';

interface Props {
  parts: PartData[];
  session: Session;
  onConfirm: (selected: PartData[]) => void;
  onBack: () => void;
}

const fmt = (v: number | null) =>
  v != null ? `R$ ${Number(v).toFixed(2)}` : null;

const ConfidenceBadge = ({ value }: { value: number }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${color}`}>
      {pct}%
    </span>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-2 px-2 py-0.5 text-[11px] border border-gray-300 rounded text-gray-500 hover:bg-gray-100 transition-colors"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
};

const PartCard = ({
  part,
  checked,
  onToggle,
}: {
  part: PartData;
  checked: boolean;
  onToggle: () => void;
}) => (
  <div
    onClick={onToggle}
    className={`mx-3 my-2 rounded-lg border cursor-pointer transition-all ${
      checked ? 'border-gray-200 bg-white shadow-sm' : 'border-gray-100 bg-gray-50 opacity-50'
    }`}
  >
    {/* Card header */}
    <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-gray-100">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 leading-tight">{part.partName}</span>
          {part.supplier && (
            <p className="text-[11px] text-gray-400 mt-0.5">Source: {part.supplier.toLowerCase()}</p>
          )}
        </div>
      </div>
      <ConfidenceBadge value={part.confidence} />
    </div>

    {/* Card fields */}
    <div className="px-3 py-2 flex flex-col gap-1.5">
      {part.oemNumber && (
        <div className="flex items-center">
          <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">OEM</span>
          <span className="font-mono text-xs text-gray-800">{part.oemNumber}</span>
          <CopyButton text={part.oemNumber} />
        </div>
      )}
      {part.supplier && (
        <div className="flex items-center">
          <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Supplier</span>
          <span className="text-xs text-gray-700">{part.supplier}</span>
        </div>
      )}
      {part.netPrice != null && (
        <div className="flex items-center">
          <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Net price</span>
          <span className="text-xs font-medium text-gray-800">{fmt(part.netPrice)}</span>
          {part.grossPrice != null && (
            <span className="text-[11px] text-gray-400 ml-2">· bruto {fmt(part.grossPrice)}</span>
          )}
        </div>
      )}
      {part.deliveryTime && (
        <div className="flex items-center">
          <span className="w-20 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entrega</span>
          <span className="text-xs text-gray-600">{part.deliveryTime}</span>
        </div>
      )}
    </div>
  </div>
);

const ResultsState = ({ parts, session, onConfirm, onBack }: Props) => {
  const [checked, setChecked] = useState<boolean[]>(() => parts.map(() => true));

  const toggle = (i: number) =>
    setChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)));

  const selectedCount = checked.filter(Boolean).length;

  const handleConfirm = () => {
    const selected = parts.filter((_, i) => checked[i]);
    if (selected.length > 0) onConfirm(selected);
  };

  return (
    <div className="flex flex-col" style={{ height: '590px' }}>
      {/* Detection banner */}
      <div className="flex items-center gap-2 mx-3 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex-shrink-0">
        <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-green-800">
            {parts.length} {parts.length === 1 ? 'peça detectada' : 'peças detectadas'} nesta página
          </p>
          <p className="text-[11px] text-green-600">{session.name}</p>
        </div>
      </div>

      {/* Parts list */}
      <div className="flex-1 overflow-y-auto py-1">
        {parts.map((part, i) => (
          <PartCard
            key={i}
            part={part}
            checked={checked[i]}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Not right
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Add to PartsIQ ({selectedCount}) →
        </button>
      </div>
    </div>
  );
};

export default ResultsState;
