// Escape text for safe interpolation into innerHTML — element content and
// quoted attribute values alike. Level names/ids can come from pasted text,
// so anything user-authored must pass through here before hitting the DOM.
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
