import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';

const REEL_COLUMNS = 5;
const REEL_ROWS = 3;
// The supplied portrait screenshot shows a roughly 1080 × 585 reel area.
// We preserve that ratio while using logical coordinates that scale at runtime.
const REFERENCE_REEL_WIDTH = 1080;
const REFERENCE_REEL_HEIGHT = 585;
const GRID_WIDTH = 720;
const GRID_HEIGHT = GRID_WIDTH / (REFERENCE_REEL_WIDTH / REFERENCE_REEL_HEIGHT);
const CELL_WIDTH = GRID_WIDTH / REEL_COLUMNS;
const CELL_HEIGHT = GRID_HEIGHT / REEL_ROWS;
const SYMBOL_MAX_WIDTH = CELL_WIDTH * 0.96;
const SYMBOL_MAX_HEIGHT = CELL_HEIGHT * 0.96;

export function createReelScene(
  symbolTextures: readonly Texture[],
  logoTexture: Texture,
): Container {
  const scene = new Container();
  const reelGrid = createReelGrid(symbolTextures);
  reelGrid.position.set(0, 30);

  const logo = new Sprite(logoTexture);
  logo.anchor.set(0.5);
  logo.scale.set(330 / logoTexture.width);
  logo.position.set(0, -285);

  const hint = new Text({
    text: 'TAP THE REELS TO SHUFFLE',
    style: {
      align: 'center',
      fill: 0xf5d9a5,
      fontFamily: 'Arial, sans-serif',
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 2,
    },
  });
  hint.anchor.set(0.5);
  hint.position.set(0, 270);

  scene.addChild(logo, reelGrid, hint);
  return scene;
}

function createReelGrid(symbolTextures: readonly Texture[]): Container {
  if (symbolTextures.length === 0) {
    throw new Error('The reel requires at least one symbol texture.');
  }

  const grid = new Container();
  const sprites: Sprite[] = [];

  const frame = new Graphics()
    .rect(-GRID_WIDTH * 0.5, -GRID_HEIGHT * 0.5, GRID_WIDTH, GRID_HEIGHT)
    .fill({ color: 0x2b0904 })
    .stroke({ color: 0xe7a62c, width: 6, alignment: 1 });

  const separators = new Graphics();

  for (let column = 1; column < REEL_COLUMNS; column += 1) {
    const x = -GRID_WIDTH * 0.5 + column * CELL_WIDTH;
    separators.moveTo(x, -GRID_HEIGHT * 0.5).lineTo(x, GRID_HEIGHT * 0.5);
  }

  separators.stroke({ color: 0xb96a15, width: 3 });

  const cells = new Container();
  cells.position.set(-GRID_WIDTH * 0.5, -GRID_HEIGHT * 0.5);

  for (let row = 0; row < REEL_ROWS; row += 1) {
    for (let column = 0; column < REEL_COLUMNS; column += 1) {
      const x = column * CELL_WIDTH;
      const y = row * CELL_HEIGHT;

      const symbol = new Sprite(Texture.EMPTY);
      symbol.anchor.set(0.5);
      symbol.position.set(x + CELL_WIDTH * 0.5, y + CELL_HEIGHT * 0.5);

      sprites.push(symbol);
      cells.addChild(symbol);
    }
  }

  const shuffleVisibleSymbols = (): void => {
    const shuffledTextures = shuffle(symbolTextures);

    sprites.forEach((sprite, index) => {
      const texture = shuffledTextures[index % shuffledTextures.length];
      sprite.texture = texture;

      const fitScale = Math.min(
        SYMBOL_MAX_WIDTH / texture.width,
        SYMBOL_MAX_HEIGHT / texture.height,
      );
      sprite.scale.set(fitScale);
    });
  };

  grid.addChild(frame, cells, separators);
  grid.hitArea = new Rectangle(
    -GRID_WIDTH * 0.5,
    -GRID_HEIGHT * 0.5,
    GRID_WIDTH,
    GRID_HEIGHT,
  );
  grid.eventMode = 'static';
  grid.cursor = 'pointer';
  grid.on('pointertap', shuffleVisibleSymbols);

  shuffleVisibleSymbols();
  return grid;
}

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
