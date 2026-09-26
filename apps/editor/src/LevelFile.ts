// A level ready to save as a `.txt` file the user can drop into
// content/data/levels/. Building it (`from`) is pure and unit-tested;
// `download` is the thin DOM part.
export class LevelFile {
  private constructor(readonly filename: string, readonly content: string) {}

  // - filename: the id made filesystem-safe, plus `.txt` (`level.txt`
  //   when there is no id);
  // - content: trailing newlines stripped, because the parser reads a
  //   trailing newline as an extra empty row.
  static from(id: string | null | undefined, text: string): LevelFile {
    const safe = String(id || 'level').replace(/[^\w.-]+/g, '_');
    return new LevelFile(`${safe}.txt`, text.replace(/\n+$/, ''));
  }

  // Save the file through a temporary download link.
  download(doc: Document = document): void {
    const url = URL.createObjectURL(
      new Blob([this.content], { type: 'text/plain;charset=utf-8' }),
    );
    const a = doc.createElement('a');
    a.href = url;
    a.download = this.filename;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
