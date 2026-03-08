import { PRICE_LEVELS, INFRA_LEVELS } from "@/lib/types";
import type { PriceLevel, InfraLevel } from "@/lib/types";

const PRICE_STYLES: Record<PriceLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  mid: "bg-zinc-100 text-zinc-600",
  high: "bg-red-50 text-red-600",
};

const INFRA_STYLES: Record<InfraLevel, string> = {
  poor: "bg-red-50 text-red-600",
  fair: "bg-zinc-100 text-zinc-600",
  good: "bg-emerald-50 text-emerald-700",
};

export function PriceBadge({ level }: { level: string | null }) {
  if (!level || !(level in PRICE_LEVELS)) return null;
  const l = level as PriceLevel;
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${PRICE_STYLES[l]}`}
    >
      {PRICE_LEVELS[l]}
    </span>
  );
}

export function InfraBadge({ level }: { level: string | null }) {
  if (!level || !(level in INFRA_LEVELS)) return null;
  const l = level as InfraLevel;
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${INFRA_STYLES[l]}`}
    >
      {INFRA_LEVELS[l]}
    </span>
  );
}
