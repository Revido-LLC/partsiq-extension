import { useState } from 'react';
import StatusChip from '@components/StatusChip';
import SessionBadge from '@components/SessionBadge';
import { CONFIG } from '@lib/constants';
import type { Session } from '@types/parts';

interface Props {
  session: Session | null;
  onCapture: () => void;
  urlChanged?: boolean;
  onDismissUrlChange?: () => void;
}

const IdleState = ({ session, onCapture, urlChanged, onDismissUrlChange }: Props) => {
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
      </div>

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
