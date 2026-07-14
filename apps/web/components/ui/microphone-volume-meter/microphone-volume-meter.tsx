import { cn } from "@/lib/utils";

interface MicrophoneVolumeMeterProps {
  level: number;
  active?: boolean;
  className?: string;
}

export function MicrophoneVolumeMeter({
  level,
  active = level >= 0.15,
  className,
}: MicrophoneVolumeMeterProps) {
  const safeLevel = Math.min(1, Math.max(0, level));
  const meterLevels = [
    0.2 + safeLevel * 0.8,
    0.15 + safeLevel * 0.85,
    0.1 + safeLevel * 0.9,
  ].map((barLevel) => Math.round(barLevel * 100) / 100);

  return (
    <span
      data-slot="microphone-volume-meter"
      className={cn("flex items-end gap-3xs", className)}
      aria-hidden="true"
    >
      {meterLevels.map((barLevel, index) => (
        <span
          key={index}
          className={cn(
            "w-2xs origin-bottom rounded-pill",
            index === 0 ? "h-xs" : index === 1 ? "h-sm" : "h-md",
            active ? "bg-success" : "bg-foreground opacity-30"
          )}
          style={{ transform: `scaleY(${barLevel})` }}
        />
      ))}
    </span>
  );
}
