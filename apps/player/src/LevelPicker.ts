import type { LevelEntry } from './LevelEntry.ts';
import type { LevelGroup } from './LevelGroup.ts';

// The level <select> (#level): filled from the catalog's groups, with an
// <optgroup> for each named group.
export class LevelPicker {
  constructor(private readonly select: HTMLSelectElement) {}

  // The selected level's id.
  get value(): string {
    return this.select.value;
  }

  set value(id: string) {
    this.select.value = id;
  }

  // Replace the options. The picker is disabled when there are no levels.
  fill(groups: readonly LevelGroup[]): void {
    const doc = this.select.ownerDocument;
    const option = (level: LevelEntry) => new Option(level.name, level.id);
    this.select.replaceChildren(
      ...groups.flatMap(({ group, levels }) => {
        if (group === null) return levels.map(option);
        const optgroup = doc.createElement('optgroup');
        optgroup.label = group;
        optgroup.append(...levels.map(option));
        return [optgroup];
      }),
    );
    this.select.disabled = groups.every((g) => g.levels.length === 0);
  }

  // Call `handler` with the new id whenever the player picks a level.
  onChange(handler: (id: string) => void): void {
    this.select.addEventListener('change', () => handler(this.select.value));
  }

  focus(): void {
    this.select.focus();
  }
}
