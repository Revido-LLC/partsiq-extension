import { buildBubbleUrl } from '@lib/iframe';
import BubbleIframe from '@components/BubbleIframe';

interface Props {
  onLoad?: () => void;
}

export default function LoginState({ onLoad }: Props) {
  return (
    <div className="relative h-full">
      <BubbleIframe
        src={buildBubbleUrl('login')}
        title="Parts iQ Login"
        className="h-full w-full"
        onLoad={onLoad}
      />
    </div>
  );
}
