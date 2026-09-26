// Player app: pick a level from the bundled manifest and play it full-window.
//
// The page is always in one of these states (mirrored on <body data-state>
// so the CSS and the e2e specs can see it):
//   loading  — fetching the level and its tileset
//   playing  — the game owns the canvas and the keyboard
//   stopped  — Esc was pressed; the level picker has focus
//   invalid  — the level failed the engine's launch gate
//   error    — something could not be fetched
import './style.css';
import { groupLevels, loadCatalog, pickLevelId } from './catalog.ts';
import { describeIssue } from './issues.ts';
import { PlaySession } from './session.ts';
import type { Catalog, LevelEntry } from './catalog.ts';
import type { ValidationIssue } from '@2d-platform/level-format';

type PageState = 'loading' | 'playing' | 'stopped' | 'invalid' | 'error';

const levelSelect = document.querySelector<HTMLSelectElement>('#level')!;
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const message = document.querySelector<HTMLElement>('#message')!;

const session = new PlaySession(canvas);
let catalog: Catalog | null = null;
let state: PageState = 'loading';

function setState(next: PageState): void {
  state = next;
  document.body.dataset.state = next;
}

// Replace the message panel with a heading and optional detail lines.
function showMessage(title: string, lines: string[] = [], asList = false): void {
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement(asList ? 'ul' : 'div');
  for (const line of lines) {
    const item = document.createElement(asList ? 'li' : 'p');
    item.textContent = line;
    body.append(item);
  }
  message.replaceChildren(heading, body);
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

// --- Level picker --------------------------------------------------------

function fillLevelSelect(levels: LevelEntry[]): void {
  const option = (level: LevelEntry) => new Option(level.name, level.id);
  levelSelect.replaceChildren(
    ...groupLevels(levels).flatMap(({ group, levels }) => {
      if (group === null) return levels.map(option);
      const optgroup = document.createElement('optgroup');
      optgroup.label = group;
      optgroup.append(...levels.map(option));
      return [optgroup];
    }),
  );
  levelSelect.disabled = levels.length === 0;
}

// Keep ?level=<id> in the address bar so the current level can be shared.
function rememberLevel(id: string): void {
  const url = new URL(location.href);
  url.searchParams.set('level', id);
  history.replaceState(null, '', url);
}

// --- Playing -------------------------------------------------------------

async function playSelectedLevel(): Promise<void> {
  const levels = catalog;
  const level = levels?.find(levelSelect.value);
  if (!levels || !level) return;

  setState('loading');
  showMessage(`Loading ${level.name}…`);
  try {
    const result = await session.start(() => levels.loadText(level));
    if (result.status === 'playing') {
      setState('playing');
      // Move focus off the <select> so the arrow keys steer the player
      // instead of changing level.
      canvas.focus({ preventScroll: true });
    } else if (result.status === 'invalid') {
      showInvalid(level, result.reasons);
    }
    // 'cancelled': a newer start() or an Esc has taken over; nothing to do.
  } catch (err) {
    setState('error');
    showMessage('Something went wrong', [errorText(err)]);
  }
}

function showInvalid(level: LevelEntry, reasons: ValidationIssue[]): void {
  setState('invalid');
  showMessage(`“${level.name}” can't be played yet`, reasons.map(describeIssue), true);
}

function stopPlaying(): void {
  session.stop();
  setState('stopped');
  showMessage('Paused', ['Choose a level, then press Enter or Space to play.']);
  levelSelect.focus();
}

// --- Wiring --------------------------------------------------------------

levelSelect.addEventListener('change', () => {
  rememberLevel(levelSelect.value);
  void playSelectedLevel();
});

// Capture phase, so Esc / Enter / Space are handled before the focused
// <select> acts on them.
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && (state === 'playing' || state === 'loading')) {
      e.preventDefault();
      stopPlaying();
    } else if ((e.key === 'Enter' || e.key === ' ') && state === 'stopped') {
      e.preventDefault();
      void playSelectedLevel();
    }
  },
  true,
);

async function init(): Promise<void> {
  try {
    catalog = await loadCatalog(fetch, import.meta.env.BASE_URL);
  } catch (err) {
    setState('error');
    showMessage('Could not load the levels', [errorText(err)]);
    return;
  }

  fillLevelSelect(catalog.levels);
  const id = pickLevelId(catalog.levels, new URLSearchParams(location.search).get('level'));
  if (id === null) {
    setState('error');
    showMessage('No levels found', ['The level manifest is empty.']);
    return;
  }
  levelSelect.value = id;
  await playSelectedLevel();
}

void init();
