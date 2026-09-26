// The editor page's entry point (loaded by index.html). Everything is
// built by EditorApp; see docs/editor/README.md for how it fits together.
import './style.css';
import { EditorApp } from './EditorApp.ts';

void new EditorApp(document.querySelector<HTMLElement>('#app')!).start();
