import type { TimeFormatPref } from "@/lib/prefs/time-format";

type ThemePref = "light" | "dark" | null;
type TextSizePref = "default" | "large" | "larger" | null;

interface InitialPreferenceScriptProps {
  themePref?: ThemePref;
  textSizePref?: TextSizePref;
  reducedMotionPref?: boolean | null;
  timeFormatPref?: TimeFormatPref;
}

export function createInitialPreferenceScript({
  themePref,
  textSizePref,
  reducedMotionPref,
  timeFormatPref,
}: InitialPreferenceScriptProps): string {
  const prefs = {
    themePref: themePref ?? null,
    textSizePref: textSizePref ?? null,
    reducedMotionPref: reducedMotionPref ?? null,
    timeFormatPref: timeFormatPref ?? null,
  };

  return `(function(){try{var prefs=${JSON.stringify(
    prefs
  )};var root=document.documentElement;if(prefs.themePref===null){delete root.dataset.theme;}else{root.dataset.theme=prefs.themePref;}if(prefs.textSizePref===null||prefs.textSizePref==="default"){delete root.dataset.textSize;}else{root.dataset.textSize=prefs.textSizePref;}if(prefs.reducedMotionPref===null){delete root.dataset.reducedMotion;}else{root.dataset.reducedMotion=String(prefs.reducedMotionPref);}if(prefs.timeFormatPref===null){delete root.dataset.timeFormat;}else{root.dataset.timeFormat=prefs.timeFormatPref;}}catch(error){}})();`;
}

/* Server-rendered before the authenticated shell so theme and accessibility
   attributes are present before React effects can run or the shell paints. */
export function InitialPreferenceScript(props: InitialPreferenceScriptProps) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: createInitialPreferenceScript(props),
      }}
    />
  );
}

