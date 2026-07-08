"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared UI vocabulary — one button shape, one card shell, one icon family
 * (16px, 1.75 stroke, currentColor) across every surface.
 */

type Variant = "primary" | "ghost" | "quiet";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong active:bg-accent-strong",
  ghost: "border border-line text-ink hover:border-line-strong hover:bg-raised active:bg-raised",
  quiet: "text-mut hover:text-ink hover:bg-raised active:bg-raised",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_oklch(0_0_0/0.04)] ${className}`}>
      {children}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function Svg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  doc: (c?: string) => (
    <Svg className={c}>
      <path d="M9.5 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5" />
      <path d="M9.5 1.75 12.75 5H9.5V1.75Z" />
      <path d="M5.5 8.5h5M5.5 11h3.5" />
    </Svg>
  ),
  upload: (c?: string) => (
    <Svg className={c}>
      <path d="M8 10.5V2.75M4.75 5.5 8 2.25l3.25 3.25" />
      <path d="M2.75 10.75v2a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1v-2" />
    </Svg>
  ),
  bulb: (c?: string) => (
    <Svg className={c}>
      <path d="M8 1.75a4.25 4.25 0 0 0-2.4 7.76c.55.38.9.98.9 1.64v.35h3v-.35c0-.66.35-1.26.9-1.64A4.25 4.25 0 0 0 8 1.75Z" />
      <path d="M6.75 13.75h2.5" />
    </Svg>
  ),
  book: (c?: string) => (
    <Svg className={c}>
      <path d="M8 3.5c-1.2-1-2.9-1.25-5.25-1.25v9.5C5.1 11.75 6.8 12 8 13c1.2-1 2.9-1.25 5.25-1.25v-9.5C10.9 2.25 9.2 2.5 8 3.5Z" />
      <path d="M8 3.5V13" />
    </Svg>
  ),
  check: (c?: string) => (
    <Svg className={c}>
      <path d="m3 8.5 3.25 3.25L13 5" />
    </Svg>
  ),
  x: (c?: string) => (
    <Svg className={c}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  ),
  arrow: (c?: string) => (
    <Svg className={c}>
      <path d="M2.75 8h10.5M9 3.75 13.25 8 9 12.25" />
    </Svg>
  ),
  refresh: (c?: string) => (
    <Svg className={c}>
      <path d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71" />
      <path d="M13.25 1.75v3h-3" />
    </Svg>
  ),
};
