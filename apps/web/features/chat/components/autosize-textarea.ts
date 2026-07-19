export function resizeAutosizeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  const contentHeight = textarea.scrollHeight;
  textarea.style.height = `${contentHeight}px`;
  textarea.style.overflowY = contentHeight > textarea.clientHeight ? "auto" : "hidden";
}
