// Report copy shared by every web surface that offers it. Block copy stays
// per-surface on purpose (the community popover explains channel visibility;
// the friends list doesn't) — report reads identically everywhere, so one
// source keeps the two surfaces from silently forking.
export function reportConfirmCopy(name: string): string {
  return `Report ${name} to the team? They won’t be told.`;
}

export function reportThanksCopy(name: string): string {
  return `Thanks — we’ve got your report about ${name}.`;
}
