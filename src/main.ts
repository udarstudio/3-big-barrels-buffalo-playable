import { Application, Container } from 'pixi.js';
import { createReelScene } from './reel-scene';
import { loadPlayableTextures } from './symbols';
import './styles.css';

const MAX_RESOLUTION = 1.5;
const PORTRAIT_DESIGN = { width: 720, height: 1280 } as const;
const LANDSCAPE_DESIGN = { width: 1280, height: 720 } as const;

async function bootstrap(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#app');

  if (!host) {
    throw new Error('Playable root element was not found.');
  }

  const app = new Application();

  await app.init({
    width: host.clientWidth,
    height: host.clientHeight,
    resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    autoDensity: true,
    antialias: true,
    backgroundAlpha: 0,
    preference: 'webgl',
  });

  await document.fonts.load('800 44px "Roboto Slab"');

  const textures = await loadPlayableTextures();
  const scene = createReelScene(
    textures.symbols,
    textures.logo,
    textures.glovePointer,
    textures.wolfHowlSheet,
    textures.buffaloVictorySheet,
    textures.featureMachines,
    textures.winGlow,
    textures.coinPile,
    app.ticker,
  );

  app.canvas.setAttribute('aria-label', 'Randomized slot reel prototype');
  host.replaceChildren(app.canvas);
  app.stage.addChild(scene);
  app.ticker.start();

  const resize = (): void => {
    const width = host.clientWidth;
    const height = host.clientHeight;

    app.renderer.resize(width, height);
    layoutScene(scene, width, height);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
}

function layoutScene(scene: Container, width: number, height: number): void {
  const isPortrait = height >= width;
  const design = isPortrait ? PORTRAIT_DESIGN : LANDSCAPE_DESIGN;
  const scale = Math.min(
    width / design.width,
    height / design.height,
  );

  scene.position.set(width * 0.5, height * 0.5);
  scene.scale.set(scale);
}

void bootstrap();
