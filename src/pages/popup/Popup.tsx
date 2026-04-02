import { useEffect, useState } from 'react';
import PopupLayout from '@components/PopupLayout';
import LoginState from '@components/states/LoginState';
import IdleState from '@components/states/IdleState';
import SessionState from '@components/states/SessionState';
import ScanningState from '@components/states/ScanningState';
import IframeState from '@components/states/IframeState';
import FallbackState from '@components/states/FallbackState';
import ConfirmState from '@components/states/ConfirmState';
import { getAuthStatus, getActiveSession } from '@lib/storage';
import { CONFIG } from '@lib/constants';
import type { PartData, PopupState, Session } from '@types/parts';

const Popup = () => {
  const [popupState, setPopupState] = useState<PopupState>('idle');
  const [parts, setParts] = useState<PartData[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = loading
  const [savedCount, setSavedCount] = useState(0);
  const [urlChanged, setUrlChanged] = useState(false);

  // Initialize auth + session on mount
  useEffect(() => {
    Promise.all([getAuthStatus(), getActiveSession()]).then(([loggedIn, activeSession]) => {
      setIsLoggedIn(loggedIn);
      setSession(activeSession);
    });
  }, []);

  // Listen for URL change notifications from background/content script
  useEffect(() => {
    const listener = (msg: { type: string }) => {
      if (msg.type === 'page_url_changed' && popupState === 'idle') {
        setUrlChanged(true);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [popupState]);

  // Show loading while checking auth
  if (isLoggedIn === null) {
    return (
      <PopupLayout>
        <div className="flex items-center justify-center h-full py-12">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PopupLayout>
    );
  }

  // Show login if not authenticated
  if (!isLoggedIn) {
    return (
      <PopupLayout compact>
        <LoginState onSuccess={() => setIsLoggedIn(true)} />
      </PopupLayout>
    );
  }

  // Show API key setup if key is missing (handled by IdleState settings gear)
  // Main state machine
  const iframeStates: PopupState[] = ['login', 'session_select', 'iframe'];
  const compact = iframeStates.includes(popupState);

  switch (popupState) {
    case 'idle':
      return (
        <PopupLayout compact={compact}>
          <IdleState
            session={session}
            onCapture={() => setPopupState('session_select')}
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
              setPopupState('iframe');
            }}
            onNotFound={() => setPopupState('fallback')}
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
