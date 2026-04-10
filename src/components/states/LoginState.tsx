import { useEffect, useRef, useState } from 'react';
import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl } from '@lib/iframe';
import { setAuthStatus } from '@lib/storage';
import type { BubbleMessage } from '@types/parts';
import { T, type Lang } from '@lib/translations';

interface Props {
  lang: Lang;
  onSuccess: (detectedLang?: Lang, autoflexConnected?: boolean) => void;
}

const LoginState = ({ lang, onSuccess }: Props) => {
  const [phase, setPhase] = useState<'checking' | 'form'>('checking');
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const t = T[lang];

  // Fallback: if Bubble doesn't respond in 5s, show login form
  useEffect(() => {
    const t = setTimeout(() => setPhase('form'), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleMessage = async (msg: BubbleMessage) => {
    console.log('[DEBUG] LoginState message received:', msg.type, msg);
    if (msg.type === 'partsiq:login_success') {
      await setAuthStatus(true);
      const raw = msg.language;
      const detectedLang: Lang | undefined =
        raw === 'en' || raw === 'nl' ? raw : undefined;
      const autoflexConnected = msg.autoflex_connected === true;
      if (iframeRef.current) {
        iframeRef.current.src = buildBubbleUrl('vehicle');
      }
      onSuccess(detectedLang, autoflexConnected);
    } else if (msg.type === 'partsiq:login_required') {
      setPhase('form');
    } else if (msg.type === 'partsiq:login_failed') {
      setPhase('form');
      setError('Login failed. Please try again.');
    }
  };

  const iframeUrl = buildBubbleUrl('login', { source: 'extension' });

  return (
    <div className="relative flex flex-col h-full flex-1">
      {phase === 'checking' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && phase === 'form' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {t.loginFailed}
        </div>
      )}
      <div className="flex-1 px-[10px] -mt-6 overflow-hidden">
        <BubbleIframe
          src={iframeUrl}
          onMessage={handleMessage}
          iframeRef={iframeRef}
          height="100%"
        />
      </div>
    </div>
  );
};

export default LoginState;
