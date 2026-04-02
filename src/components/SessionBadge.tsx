import type { Session } from '@types/parts';

interface Props {
  session: Session | null;
}

const SessionBadge = ({ session }: Props) => {
  if (!session) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
      <span className="font-medium">{session.name}</span>
      <span className="text-blue-400">·</span>
      <span>{session.partCount} {session.partCount === 1 ? 'part' : 'parts'}</span>
    </div>
  );
};

export default SessionBadge;
