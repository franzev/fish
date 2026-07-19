export type CommandResult<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; notice: string };
