import type { InputHTMLAttributes, ReactNode } from "react"

export function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-md px-2.5 py-1 text-xs font-medium font-body">
      {label}
    </span>
  )
}

export function Avatar({
  name,
  role,
  size = "md",
}: {
  name: string
  role?: string
  size?: "sm" | "md" | "lg"
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const dims = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base" }[size]

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-white font-semibold font-display flex-shrink-0 ${dims}`}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800 font-body truncate">{name}</p>
        {role && <p className="text-xs text-neutral-500 font-body truncate">{role}</p>}
      </div>
    </div>
  )
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`bg-white border border-neutral-200 rounded-xl shadow-sm ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  )
}

export function Input({
  label,
  hint,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium text-neutral-700 font-body mb-1.5">
          {label}
        </span>
      )}
      <input
        className={`w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm font-body text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition ${className}`}
        {...rest}
      />
      {hint && <span className="block text-xs text-neutral-400 font-body mt-1">{hint}</span>}
    </label>
  )
}
