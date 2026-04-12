import type { Lang } from '@types/parts';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  lang: Lang;
  hasError: boolean;
  onRetry: () => void;
}

export default function LoginState(_props: Props) {

  return (
    <div className="relative h-full px-[10px]">
      <iframe
        src={buildBubbleUrl('login')}
        className="absolute inset-x-[10px] inset-y-0 w-[calc(100%-20px)] h-full border-0"
        title="PartsIQ Login"
      />
    </div>
  );
}
