/** Dutch license plate, same look as the WO panel header (blue NL band + yellow plate). */
export default function Plate({ plate }: { plate?: string | null }) {
  const text = plate?.trim();
  if (!text) return null;
  return (
    <span className="inline-flex h-6 shrink-0 overflow-hidden rounded align-middle">
      <span className="flex w-[18px] items-end justify-center bg-pq-plate-blue pb-0.5 text-[8px] font-bold leading-none text-white">
        NL
      </span>
      <span className="flex items-center bg-pq-plate-yellow px-1.5 text-sm font-bold leading-none text-black">
        {text}
      </span>
    </span>
  );
}
