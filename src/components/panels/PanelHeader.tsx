import Card from '@components/ui/Card';
import Plate from '@components/ui/Plate';

interface Props {
  plate?: string | null;
  changeLabel: string;
  onChange: () => void;
  backLabel: string;
  onBack?: () => void;
}

/** Header card of the scan/cart screens: "Parts iQ" + plate, then back / change links. */
export default function PanelHeader({ plate, changeLabel, onChange, backLabel, onBack }: Props) {
  return (
    <Card className="shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-black">Parts iQ</span>
        <span className="flex-1" />
        <Plate plate={plate} />
      </div>
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} className="text-[13px] font-medium text-pq-teal hover:underline">
            ← {backLabel}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onChange} className="text-[13px] font-medium text-pq-teal hover:underline">
          {changeLabel}
        </button>
      </div>
    </Card>
  );
}
