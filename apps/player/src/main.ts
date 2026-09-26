// Player app entry point (index.html loads this). The composition root:
// finds the page's elements, builds the real collaborators, and starts
// PlayerApp. All behaviour lives in the classes; see ../README.md.
import './style.css';
import { LevelCatalog } from './LevelCatalog.ts';
import { LevelUrl } from './LevelUrl.ts';
import { PlaySession } from './PlaySession.ts';
import { PlayerApp } from './PlayerApp.ts';
import { PlayerView } from './PlayerView.ts';

const view = PlayerView.fromDocument(document);
const app = new PlayerApp(
  view,
  new PlaySession(view.canvas),
  new LevelUrl(location, history),
  () => LevelCatalog.load(fetch, import.meta.env.BASE_URL),
);

void app.start();
