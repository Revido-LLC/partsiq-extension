import type { Lang } from '@app-types/parts';
import { useT } from '@lib/i18n';
import Card from '@components/ui/Card';
import PillButton from '@components/ui/PillButton';
import Tag from '@components/ui/Tag';

interface Props {
  lang: Lang;
  error: string | null;
  screenshot: string | null;
  onRetry: () => void;
}

export default function ScanningState({ lang, error, screenshot, onRetry }: Props) {
  const t = useT(lang);

  if (error) {
    return (
      <Card className="items-center gap-3 py-6 text-center">
        <p className="text-sm font-semibold text-black">{t.scanError}</p>
        <Tag tone="amber">{error}</Tag>
        <PillButton variant="primary" onClick={onRetry}>
          {t.retry}
        </PillButton>
      </Card>
    );
  }

  return (
    <Card className="items-center gap-3 py-5 text-center">
      {screenshot && (
        <div className="w-full rounded-md overflow-hidden border border-pq-line relative">
          <img
            src={`data:image/jpeg;base64,${screenshot}`}
            alt="screenshot"
            className="w-full object-cover opacity-80"
            style={{ maxHeight: '180px' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
      {!screenshot && (
        <div className="w-6 h-6 border-2 border-pq-teal border-t-transparent rounded-full animate-spin" />
      )}
      <p className="text-[13px] font-medium text-pq-muted">{t.analyzing}</p>
    </Card>
  );
}
