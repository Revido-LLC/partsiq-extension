import { useEffect, useRef, useState } from 'react';
import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl, sendToIframe } from '@lib/iframe';
import { setActiveSession } from '@lib/storage';
import { CONFIG } from '@lib/constants';
import type { BubbleMessage, PartData, PartsSavedMessage, Session } from '@types/parts';

interface Props {
  parts: PartData[];
  session: Session;
  onSaved: (count: number) => void;
}

const IframeState = ({ parts, session, onSaved }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Build URL — try to include parts in URL params if short enough
  const partsJson = JSON.stringify(parts);
  const params: Record<string, string> = { session_id: session.id };
  const urlWithParts = buildBubbleUrl('parts', { ...params, parts: partsJson });
  const usePostMessage = urlWithParts.length > CONFIG.MAX_URL_PARAM_LENGTH;
  const iframeSrc = usePostMessage ? buildBubbleUrl('parts', params) : urlWithParts;

  // Send parts via postMessage after iframe is ready (if URL was too long)
  useEffect(() => {
    if (iframeReady && usePostMessage && iframeRef.current) {
      sendToIframe(iframeRef.current, { type: 'partsiq:set_parts', parts });
      sendToIframe(iframeRef.current, { type: 'partsiq:set_session', sessionId: session.id });
    }
  }, [iframeReady]);

  const handleMessage = async (msg: BubbleMessage) => {
    if (msg.type === 'partsiq:ready') {
      setIframeReady(true);
    } else if (msg.type === 'partsiq:parts_saved') {
      const m = msg as PartsSavedMessage;
      await setActiveSession({ ...session, partCount: session.partCount + m.count });
      onSaved(m.count);
    }
  };

  return (
    <BubbleIframe
      src={iframeSrc}
      onMessage={handleMessage}
      iframeRef={iframeRef}
      height="460px"
    />
  );
};

export default IframeState;
