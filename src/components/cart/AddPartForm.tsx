import { useState } from 'react';
import { T, type Lang } from '@lib/translations';

interface Props {
  lang: Lang;
  onAdd: (partName: string, oemNumber: string) => void;
}

const AddPartForm = ({ lang, onAdd }: Props) => {
  const [open, setOpen] = useState(false);
  const [partName, setPartName] = useState('');
  const [oemNumber, setOemNumber] = useState('');
  const t = T[lang];

  const handleSubmit = () => {
    const name = partName.trim();
    if (!name || !oemNumber.trim()) return;
    onAdd(name, oemNumber.trim());
    setPartName('');
    setOemNumber('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border-b border-gray-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t.addManually}
      </button>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/40 flex flex-col gap-2">
      <input
        autoFocus
        type="text"
        placeholder={t.partName}
        value={partName}
        onChange={e => setPartName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-blue-400 placeholder-gray-400"
      />
      <input
        type="text"
        placeholder={t.oemNumber}
        value={oemNumber}
        onChange={e => setOemNumber(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-blue-400 placeholder-gray-400"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
        >
          {t.cancel}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!partName.trim() || !oemNumber.trim()}
          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md transition-colors"
        >
          {t.add}
        </button>
      </div>
    </div>
  );
};

export default AddPartForm;
