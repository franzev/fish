import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  label: string;
  className?: string;
}

export function CircularProgress({ value, label, className }: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <svg
      viewBox="0 0 56 56"
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      data-shape="circular"
      className={cn("size-control", className)}
    >
      <circle
        cx="28"
        cy="28"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-border"
      />
      <circle
        cx="28"
        cy="28"
        r="23"
        pathLength="100"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset={100 - clamped}
        className="text-foreground transition-progress duration-progress"
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}
