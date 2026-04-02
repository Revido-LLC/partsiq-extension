import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl } from '@lib/iframe';
import { setActiveSession } from '@lib/storage';
import type { BubbleMessage, Session, SessionCreatedMessage, SessionSelectedMessage } from '@types/parts';

interface Props {
  currentSession: Session | null;
  onSelect: (session: Session) => void;
}

const SessionState = ({ currentSession, onSelect }: Props) => {
  const handleMessage = async (msg: BubbleMessage) => {
    if (msg.type === 'partsiq:session_created') {
      const m = msg as SessionCreatedMessage;
      const session: Session = {
        id: m.sessionId,
        name: m.name,
        createdAt: new Date().toISOString(),
        partCount: 0,
      };
      await setActiveSession(session);
      onSelect(session);
    } else if (msg.type === 'partsiq:session_selected') {
      const m = msg as SessionSelectedMessage;
      // If selecting existing session we already know about, use it
      if (currentSession && currentSession.id === m.sessionId) {
        onSelect(currentSession);
      } else {
        // Create a minimal session object for unknown sessions
        const session: Session = {
          id: m.sessionId,
          name: 'Session',
          createdAt: new Date().toISOString(),
          partCount: 0,
        };
        await setActiveSession(session);
        onSelect(session);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {currentSession && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <button
            onClick={() => onSelect(currentSession)}
            className="w-full text-left text-xs text-blue-600 hover:underline py-1"
          >
            ↩ Continue with "{currentSession.name}" ({currentSession.partCount} parts)
          </button>
        </div>
      )}
      <BubbleIframe
        src={buildBubbleUrl('session')}
        onMessage={handleMessage}
        height={currentSession ? '420px' : '460px'}
      />
    </div>
  );
};

export default SessionState;
