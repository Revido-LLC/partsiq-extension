import { useEffect, useState } from 'react';
import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl } from '@lib/iframe';
import { setAuthStatus } from '@lib/storage';
import type { BubbleMessage } from '@types/parts';

interface Props {
  onSuccess: () => void;
}

const LoginState = ({ onSuccess }: Props) => {
  const [phase, setPhase] = useState<'checking' | 'form'>('checking');
  const [error, setError] = useState<string | null>(null);

  // Fallback: if Bubble doesn't respond in 5s, show login form
  useEffect(() => {
    const t = setTimeout(() => setPhase('form'), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleMessage = async (msg: BubbleMessage) => {
    if (msg.type === 'partsiq:login_success') {
      await setAuthStatus(true);
      onSuccess();
    } else if (msg.type === 'partsiq:login_required') {
      setPhase('form');
    } else if (msg.type === 'partsiq:login_failed') {
      setPhase('form');
      setError('Login failed. Please try again.');
    }
  };

  const iframeUrl = buildBubbleUrl('login', { source: 'extension' });

  return (
    <div className="relative flex flex-col h-full">
      {phase === 'checking' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && phase === 'form' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}
      <BubbleIframe
        src={iframeUrl}
        onMessage={handleMessage}
        height="460px"
      />
    </div>
  );
};

export default LoginState;
