import { Application, Container, Graphics, Text } from 'pixi.js';
import './styles.css';

const MAX_RESOLUTION = 1.5;
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;
const SAFE_INSET = 16;
const MIN_SCENE_SCALE = 0.2;

async function bootstrap(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#app');

  if (!host) {
    throw new Error('Playable root element was not found.');
  }

  const app = new Application();

  await app.init({
    resizeTo: host,
    resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    autoDensity: true,
    antialias: true,
    background: '#120b08',
    preference: 'webgl',
  });

  app.canvas.setAttribute('aria-label', 'Playable rendering canvas');
  host.replaceChildren(app.canvas);

  const scene = createFoundationScene();
  app.stage.addChild(scene);

  const layout = (): void => {
    scene.position.set(app.screen.width * 0.5, app.screen.height * 0.5);

    const safeWidth = Math.max(app.screen.width - SAFE_INSET * 2, 1);
    const safeHeight = Math.max(app.screen.height - SAFE_INSET * 2, 1);
    const scale = Math.min(
      safeWidth / DESIGN_WIDTH,
      safeHeight / DESIGN_HEIGHT,
    );

    scene.scale.set(Math.max(scale, MIN_SCENE_SCALE));
  };

  layout();
  window.addEventListener('resize', layout, { passive: true });
}

function createFoundationScene(): Container {
  const scene = new Container();

  const panel = new Graphics()
    .roundRect(-310, -230, 620, 460, 36)
    .fill({ color: 0x2a130b, alpha: 0.96 })
    .stroke({ color: 0xe1a63a, width: 8 });

  const title = new Text({
    text: '3 BIG BARRELS\nBUFFALO',
    style: {
      align: 'center',
      fill: 0xffd56a,
      fontFamily: 'Arial, sans-serif',
      fontSize: 58,
      fontWeight: '900',
      lineHeight: 60,
      stroke: { color: 0x4b1806, width: 8 },
    },
  });
  title.anchor.set(0.5);
  title.position.set(0, -70);

  const status = new Text({
    text: 'PixiJS + TypeScript foundation ready',
    style: {
      align: 'center',
      fill: 0xffffff,
      fontFamily: 'Arial, sans-serif',
      fontSize: 25,
    },
  });
  status.anchor.set(0.5);
  status.position.set(0, 85);

  const hint = new Text({
    text: 'Responsive single-file build',
    style: {
      align: 'center',
      fill: 0xd6b48a,
      fontFamily: 'Arial, sans-serif',
      fontSize: 20,
    },
  });
  hint.anchor.set(0.5);
  hint.position.set(0, 135);

  scene.addChild(panel, title, status, hint);
  return scene;
}

void bootstrap();
