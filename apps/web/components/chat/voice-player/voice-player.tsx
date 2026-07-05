"use client";

import { cn } from "@/lib/utils";
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { HTMLAttributes, useState } from "react";

interface VoicePlayerProps extends HTMLAttributes<HTMLDivElement> {
  duration?: string;
  /** 0-100. A static waveform position — no real audio decode in this kit. */
  progress?: number;
}

/** A voice-message player: play/pause control + a visual scrubber/waveform
 *  placeholder + duration. Presentational only — toggling play just flips a
 *  local icon state, no real playback. */
export function VoicePlayer({
  duration = "0:12",
  progress = 30,
  className,
  ...props
}: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-control border border-border bg-surface p-3",
        className
      )}
      {...props}
    >
      <button
        type="button"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        aria-pressed={playing}
        onClick={() => setPlaying((v) => !v)}
        className="flex min-h-control min-w-control shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
      >
        {playing ? (
          <IconPlayerPause size={18} stroke={1.75} aria-hidden="true" />
        ) : (
          <IconPlayerPlay size={18} stroke={1.75} aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="progressbar"
          aria-label="Playback progress"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-pill bg-surface-2"
        >
          <div className="h-full rounded-pill bg-muted" style={{ width: `${clamped}%` }} />
        </div>
      </div>
      <span className="shrink-0 text-ui-xs text-muted">{duration}</span>
    </div>
  );
}
