import { cn } from "@/lib/utils";

/** Wordmark mark — abstract mat / bracket glyph */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      aria-hidden
    >
      <rect x="4" y="4" width="40" height="40" rx="10" className="fill-primary/15 stroke-primary" strokeWidth="2" />
      <path
        d="M14 32V16h6l4 10 4-10h6v16h-5V22.5L25.5 32h-3L19 22.5V32h-5z"
        className="fill-current"
      />
    </svg>
  );
}
