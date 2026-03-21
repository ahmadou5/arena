// src/components/DivisionBadge.tsx
import Image from "next/image";

const BADGE_FILES: Record<number, string> = {
  1: "/badges/grandmaster.png",
  2: "/badges/diamond.png",
  3: "/badges/platinum.png",
  4: "/badges/gold.png",
  5: "/badges/silver.png",
};

const DIVISION_NAMES: Record<number, string> = {
  1: "Grandmaster",
  2: "Diamond",
  3: "Platinum",
  4: "Gold",
  5: "Silver",
};

interface DivisionBadgeProps {
  division: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}

const SIZES = {
  sm: { px: 24, labelClass: "text-[9px]" },
  md: { px: 40, labelClass: "text-[10px]" },
  lg: { px: 80, labelClass: "text-xs" },
  xl: { px: 160, labelClass: "text-sm" },
};

export default function DivisionBadge({
  division,
  size = "md",
  showLabel = false,
  className = "",
}: DivisionBadgeProps) {
  const { px, labelClass } = SIZES[size];
  const src = BADGE_FILES[division] ?? BADGE_FILES[5];
  const name = DIVISION_NAMES[division] ?? "Silver";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <Image
        src={src}
        alt={`${name} division badge`}
        width={px}
        height={px}
        className="object-contain"
        style={{ imageRendering: "crisp-edges" }}
      />
      {showLabel && (
        <span
          className={`font-mono uppercase tracking-widest text-[#8a8880] ${labelClass}`}
        >
          {name}
        </span>
      )}
    </div>
  );
}
