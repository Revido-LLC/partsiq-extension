import { useEffect, useState } from 'react';
import StatusChip from '@components/StatusChip';
import { captureScreenshot } from '@lib/screenshot';
import { extractPartsFromScreenshot } from '@lib/ai';
import type { PartData, Session } from '@types/parts';

interface Props {
  session: Session;
  onFound: (parts: PartData[]) => void;
  onNotFound: () => void;
}

const ScanningState = ({ session, onFound, onNotFound }: Props) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setError(null);
    try {
      const base64 = await captureScreenshot();
      setScreenshot(base64);
      const parts = await extractPartsFromScreenshot(base64);
      if (parts.length > 0) {
        onFound(parts);
      } else {
        onNotFound();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    }
  };

  useEffect(() => {
    runScan();
  }, []); // Run once on mount

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <StatusChip variant="error" />
        <p className="text-sm text-gray-600 text-center">{error}</p>
        <button
          onClick={runScan}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <StatusChip variant="scanning" />
      <p className="text-sm text-gray-500">Analyzing screenshot with AI...</p>
      <p className="text-xs text-gray-400">Session: {session.name}</p>
      {screenshot && (
        <img
          src={screenshot}
          alt="Captured screenshot"
          className="w-full rounded border border-gray-200 opacity-60"
          style={{ maxHeight: '160px', objectFit: 'cover', objectPosition: 'top' }}
        />
      )}
    </div>
  );
};

export default ScanningState;
