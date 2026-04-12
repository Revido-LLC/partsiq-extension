import { useEffect, useRef } from 'react';

interface Props {
  onDone: () => void;
}

export default function CropHintOverlay({ onDone }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(onDone, 2500);
    return () => clearTimeout(timerRef.current);
  }, [onDone]);

  const handleClick = () => {
    clearTimeout(timerRef.current);
    onDone();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/65 cursor-pointer select-none"
      onClick={handleClick}
    >
      <div className="relative w-[160px] h-[110px] rounded border border-white/20 bg-white/5">
        <div className="crop-hint-box" />
        <div className="crop-hint-cursor">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 2L4 14L7.5 11L9.5 16L11.5 15.2L9.5 10.2L13.5 10.2L4 2Z"
              fill="white"
              stroke="#1d4ed8"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-white text-xs font-medium">Drag to select an area</p>
        <p className="text-white/40 text-xs">Click to skip</p>
      </div>
    </div>
  );
}
