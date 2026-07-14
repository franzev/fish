import "server-only";

const DEFAULT_LESSON_JOIN_WINDOW_MINUTES = 10;
const MAX_LESSON_JOIN_WINDOW_MINUTES = 24 * 60;

type JoinWindowEnv = {
  readonly [key: string]: string | undefined;
};

export function getLessonJoinWindowMinutes(
  source: JoinWindowEnv = process.env
): number {
  const value = source.LESSON_JOIN_WINDOW_MINUTES?.trim();
  if (!value || !/^\d+$/.test(value)) {
    return DEFAULT_LESSON_JOIN_WINDOW_MINUTES;
  }

  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes <= MAX_LESSON_JOIN_WINDOW_MINUTES
    ? minutes
    : DEFAULT_LESSON_JOIN_WINDOW_MINUTES;
}
