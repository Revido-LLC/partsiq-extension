import { useState } from 'react';
import type { PartData } from '@types/parts';

interface Props {
  onSubmit: (parts: PartData[]) => void;
}

interface PartRow {
  oemNumber: string;
  partName: string;
  netPrice: string;
  grossPrice: string;
}

const emptyRow = (): PartRow => ({ oemNumber: '', partName: '', netPrice: '', grossPrice: '' });

const FallbackState = ({ onSubmit }: Props) => {
  const [rows, setRows] = useState<PartRow[]>([emptyRow()]);

  const updateRow = (index: number, field: keyof PartRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = () => {
    const parts: PartData[] = rows
      .filter((r) => r.oemNumber.trim() !== '')
      .map((r) => ({
        partName: r.partName.trim() || r.oemNumber.trim(),
        oemNumber: r.oemNumber.trim(),
        netPrice: r.netPrice ? parseFloat(r.netPrice) : null,
        grossPrice: r.grossPrice ? parseFloat(r.grossPrice) : null,
        deliveryTime: null,
        stockAvailable: null,
        supplier: null,
        confidence: 1.0, // manually entered = certain
      }));

    if (parts.length > 0) onSubmit(parts);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-sm text-gray-600">
        <p className="font-medium">No parts detected automatically</p>
        <p className="text-xs text-gray-400 mt-0.5">Enter part details manually</p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              placeholder="OEM number *"
              value={row.oemNumber}
              onChange={(e) => updateRow(i, 'oemNumber', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              placeholder="Part name"
              value={row.partName}
              onChange={(e) => updateRow(i, 'partName', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                placeholder="Net price"
                value={row.netPrice}
                onChange={(e) => updateRow(i, 'netPrice', e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                type="number"
                min="0"
                step="0.01"
              />
              <input
                placeholder="Gross price"
                value={row.grossPrice}
                onChange={(e) => updateRow(i, 'grossPrice', e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="text-xs text-blue-600 hover:underline self-start"
      >
        + Add another part
      </button>

      <button
        onClick={handleSubmit}
        disabled={rows.every((r) => r.oemNumber.trim() === '')}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-sm transition-colors"
      >
        Submit parts
      </button>
    </div>
  );
};

export default FallbackState;
