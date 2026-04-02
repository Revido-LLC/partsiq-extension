import { useRef } from 'react';
import type { BubbleMessage } from '@types/parts';
import { useBubbleMessages } from '@lib/iframe';

interface Props {
  src: string;
  onMessage: (msg: BubbleMessage) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  height?: string;
}

const BubbleIframe = ({ src, onMessage, iframeRef, height = '460px' }: Props) => {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const ref = iframeRef ?? internalRef;

  useBubbleMessages(onMessage);

  return (
    <iframe
      ref={ref}
      src={src}
      style={{ width: '100%', height, border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms"
      title="PartsIQ"
    />
  );
};

export default BubbleIframe;
