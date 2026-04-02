import { useEffect, useState } from 'react';
import StatusChip from '@components/StatusChip';
import SessionBadge from '@components/SessionBadge';
import { CONFIG } from '@lib/constants';
import { getApiKey, setApiKey } from '@lib/storage';
import type { Session } from '@types/parts';

interface Props {
  session: Session | null;
  onCapture: () => void;
  urlChanged?: boolean;
  onDismissUrlChange?: () => void;
}

const IdleState = ({ session, onCapture, urlChanged, onDismissUrlChange }: Props) => {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  useEffect(() => {
    if (showSettings) {
      getApiKey().then((key) => {
        if (key) setApiKeyState(key);
      });
    }
  }, [showSettings]);

  const handleSaveApiKey = async () => {
    await setApiKey(apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {urlChanged && (
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
          <span>Page changed. Re-scan?</span>
          <div className="flex gap-2">
            <button onClick={onCapture} className="font-medium underline">Scan now</button>
            <button onClick={onDismissUrlChange} className="text-amber-500">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <StatusChip variant="idle" />
        <div className="flex items-center gap-2">
          <a
            href={CONFIG.BUBBLE_BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              chrome.tabs.create({ url: CONFIG.BUBBLE_BASE_URL });
            }}
          >
            Open PartsIQ ↗
          </a>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs font-medium text-gray-700">OpenRouter API Key</p>
          <input
            type="password"
            placeholder="sk-or-..."
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={!apiKey.trim()}
            className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-xs font-medium rounded transition-colors"
          >
            {apiKeySaved ? 'Saved!' : 'Save key'}
          </button>
        </div>
      )}

      {session && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Active session</span>
          <SessionBadge session={session} />
        </div>
      )}

      <button
        onClick={onCapture}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
      >
        {session ? `Add parts to "${session.name}"` : 'Capture parts'}
      </button>

      {!session && (
        <p className="text-xs text-gray-400 text-center">
          Click to capture part data from this page using AI
        </p>
      )}
    </div>
  );
};

export default IdleState;
