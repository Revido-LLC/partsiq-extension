import { useState, useEffect } from 'react';
import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  lang: Lang;
  hasError: boolean;
  onRetry: () => void;
}

const LOGIN_TIMEOUT_MS = 10_000;

export default function LoginState({ lang, hasError, onRetry }: Props) {
  const t = useT(lang);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), LOGIN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <iframe
        src={buildBubbleUrl('login')}
        className="flex-1 w-full border-0"
        title="PartsIQ Login"
      />
      {(hasError || timedOut) && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center justify-between">
          <span>{t.loginError}</span>
          <button
            onClick={onRetry}
            className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            {t.retry}
          </button>
        </div>
      )}
    </div>
  );
}
