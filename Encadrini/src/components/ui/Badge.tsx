export type BadgeVariant =
  | "pending"
  | "accepted"
  | "analysed"
  | "rejected"
  | "draft"
  | "reviewing"

const badgeConfig: Record<
  BadgeVariant,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: { label: "En attente", bg: "bg-warning-100", text: "text-[#92400e]", dot: "bg-[#f59e0b]" },
  accepted: { label: "Acceptée", bg: "bg-success-100", text: "text-[#14532d]", dot: "bg-success-600" },
  analysed: { label: "Analysé par IA", bg: "bg-ai-100", text: "text-[#4c1d95]", dot: "bg-ai-600" },
  rejected: { label: "Refusée", bg: "bg-danger-100", text: "text-[#7f1d1d]", dot: "bg-danger-600" },
  draft: { label: "Brouillon", bg: "bg-neutral-100", text: "text-neutral-600", dot: "bg-neutral-400" },
  reviewing: { label: "En révision", bg: "bg-info-100", text: "text-[#1e3a5f]", dot: "bg-info-600" },
}

export function StatusBadge({ variant }: { variant: BadgeVariant }) {
  const cfg = badgeConfig[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium font-body ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
