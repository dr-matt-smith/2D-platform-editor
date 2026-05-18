// Export the buffer as a .txt the user can drop into public/data/levels/.
// The pure part (toLevelFile) is unit-tested; the DOM click path is verified
// by dev smoke (design v3 §7, milestone 5).

/**
 * Build the downloadable file for a level.
 * - filename: sanitised `<id>.txt`
 * - content: trailing newlines stripped so it re-parses identically to the
 *   buffer (the parser treats a trailing newline as an extra empty row).
 */
export function toLevelFile(id, text) {
  const safe = String(id || 'level').replace(/[^\w.-]+/g, '_');
  return { filename: `${safe}.txt`, content: text.replace(/\n+$/, '') };
}

export function downloadText(id, text, doc = document) {
  const { filename, content } = toLevelFile(id, text);
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
  );
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
