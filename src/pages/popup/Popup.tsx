import { useEffect, useRef, useState } from 'react';
import PopupLayout from '@components/PopupLayout';
import LoginState from '@components/states/LoginState';
import IdleState from '@components/states/IdleState';
import SessionState from '@components/states/SessionState';
import ScanningState from '@components/states/ScanningState';
import ResultsState from '@components/states/ResultsState';
import IframeState from '@components/states/IframeState';
import FallbackState from '@components/states/FallbackState';
import ConfirmState from '@components/states/ConfirmState';
import { getActiveSession } from '@lib/storage';
import { CONFIG } from '@lib/constants';
import type { PartData, PopupState, Session } from '@types/parts';

const Popup = () => {
  const [popupState, setPopupState] = useState<PopupState>('idle');
  const [parts, setParts] = useState<PartData[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [urlChanged, setUrlChanged] = useState(false);

  const popupStateRef = useRef(popupState);
  popupStateRef.current = popupState;

  // Load active session on mount (auth is verified via Bubble iframe)
  useEffect(() => {
    getActiveSession().then(setSession);
  }, []);

  // Listen for URL change notifications from background/content script
  useEffect(() => {
    const listener = (msg: { type: string }) => {
      if (msg.type === 'page_url_changed' && popupStateRef.current === 'idle') {
        setUrlChanged(true);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []); // registers once, reads latest state via ref

  // Show login if not authenticated (LoginState verifies with Bubble on every open)
  if (!isLoggedIn) {
    return (
      <PopupLayout compact>
        <LoginState onSuccess={() => setIsLoggedIn(true)} />
      </PopupLayout>
    );
  }

  // Show API key setup if key is missing (handled by IdleState settings gear)
  // Main state machine
  const iframeStates: PopupState[] = ['session_select', 'iframe'];
  const compact = iframeStates.includes(popupState);

  switch (popupState) {
    case 'idle':
      return (
        <PopupLayout compact={compact}>
          <IdleState
            session={session}
            onCapture={() => {
      if (!session) {
        const defaultSession = { id: 'default', name: 'Nova sessão', createdAt: new Date().toISOString(), partCount: 0 };
        setSession(defaultSession);
      }
      setPopupState('scanning');
    }}
            urlChanged={urlChanged}
            onDismissUrlChange={() => setUrlChanged(false)}
          />
        </PopupLayout>
      );

    case 'session_select':
      return (
        <PopupLayout compact>
          <SessionState
            currentSession={session}
            onSelect={(s) => {
              setSession(s);
              setPopupState('scanning');
            }}
          />
        </PopupLayout>
      );

    case 'scanning':
      return (
        <PopupLayout>
          <ScanningState
            session={session!}
            onFound={(p) => {
              setParts(p);
              setPopupState('results');
            }}
            onNotFound={() => setPopupState('fallback')}
          />
        </PopupLayout>
      );

    case 'results':
      return (
        <PopupLayout compact>
          <ResultsState
            parts={parts}
            session={session!}
            onConfirm={(selected) => {
              setParts(selected);
              setPopupState('iframe');
            }}
            onBack={() => setPopupState('idle')}
          />
        </PopupLayout>
      );

    case 'iframe':
      return (
        <PopupLayout compact>
          <IframeState
            parts={parts}
            session={session!}
            onSaved={(count) => {
              setSavedCount(count);
              setSession((prev) => prev ? { ...prev, partCount: prev.partCount + count } : prev);
              setPopupState('confirm');
            }}
          />
        </PopupLayout>
      );

    case 'fallback':
      return (
        <PopupLayout>
          <FallbackState
            onSubmit={(p) => {
              setParts(p);
              setPopupState('iframe');
            }}
          />
        </PopupLayout>
      );

    case 'confirm':
      return (
        <PopupLayout>
          <ConfirmState
            savedCount={savedCount}
            session={session!}
            onClose={() => window.close()}
            onMore={() => setPopupState('session_select')}
          />
        </PopupLayout>
      );

    default:
      return null;
  }
};

export default Popup;
