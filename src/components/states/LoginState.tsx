import { useState } from 'react';
import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl } from '@lib/iframe';
import { setAuthStatus } from '@lib/storage';
import type { BubbleMessage, LoginSuccessMessage } from '@types/parts';

interface Props {
  onSuccess: (userId: string) => void;
}

const LoginState = ({ onSuccess }: Props) => {
  const [error, setError] = useState<string | null>(null);

  const handleMessage = async (msg: BubbleMessage) => {
    if (msg.type === 'partsiq:login_success') {
      const loginMsg = msg as LoginSuccessMessage;
      await setAuthStatus(true);
      onSuccess(loginMsg.userId);
    } else if (msg.type === 'partsiq:login_failed') {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}
      <BubbleIframe
        src={buildBubbleUrl('login')}
        onMessage={handleMessage}
        height="460px"
      />
    </div>
  );
};

export default LoginState;
