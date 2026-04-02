import SessionBadge from '@components/SessionBadge';
import { CONFIG } from '@lib/constants';
import type { Session } from '@types/parts';

interface Props {
  savedCount: number;
  session: Session;
  onClose: () => void;
  onMore: () => void;
}

const ConfirmState = ({ savedCount, session, onClose, onMore }: Props) => {
  const handleOpenPartsIQ = () => {
    chrome.tabs.create({ url: CONFIG.BUBBLE_BASE_URL });
    window.close();
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="text-center">
        <p className="font-semibold text-gray-900">
          {savedCount} {savedCount === 1 ? 'part' : 'parts'} saved
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Added to session:</p>
        <div className="mt-2">
          <SessionBadge session={{ ...session, partCount: session.partCount }} />
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={handleOpenPartsIQ}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Open PartsIQ
        </button>
        <button
          onClick={onMore}
          className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
        >
          Add more parts
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ConfirmState;
