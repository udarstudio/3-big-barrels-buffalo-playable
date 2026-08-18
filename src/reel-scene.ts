import {
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  Ticker,
} from 'pixi.js';
import type { PlayableSymbol } from './symbols';

const REEL_COLUMNS = 5;
const REEL_ROWS = 3;
// The supplied portrait screenshot shows a roughly 1080 × 585 reel area.
// We preserve that ratio while using logical coordinates that scale at runtime.
const REFERENCE_REEL_WIDTH = 1080;
const REFERENCE_REEL_HEIGHT = 585;
const GRID_WIDTH = 720;
const GRID_HEIGHT = GRID_WIDTH / (REFERENCE_REEL_WIDTH / REFERENCE_REEL_HEIGHT);
const FRAME_RAIL_WIDTH = 8;
const REEL_CONTENT_WIDTH = GRID_WIDTH - FRAME_RAIL_WIDTH * 2;
const REEL_CONTENT_HEIGHT = GRID_HEIGHT - FRAME_RAIL_WIDTH * 2;
const REEL_CONTENT_LEFT = -REEL_CONTENT_WIDTH * 0.5;
const REEL_CONTENT_TOP = -REEL_CONTENT_HEIGHT * 0.5;
const CELL_WIDTH = REEL_CONTENT_WIDTH / REEL_COLUMNS;
const CELL_HEIGHT = REEL_CONTENT_HEIGHT / REEL_ROWS;
const SYMBOL_SIZE = CELL_WIDTH;
const SPIN_BUTTON_WIDTH = 300;
const SPIN_BUTTON_HEIGHT = 100;
const SPIN_BUTTON_INSET = 10;
const SPIN_BUTTON_Y = 308;
const SPIN_BUTTON_SHADOW_OFFSET = 8;
const SPIN_BUTTON_PRESS_SCALE = 0.96;
const GUIDE_HAND_HEIGHT = 240;
const GUIDE_HAND_TARGET_X = 20;
const GUIDE_HAND_TARGET_Y = SPIN_BUTTON_Y + 30;
const GUIDE_HAND_ROTATION = Math.PI * 0.8;
const GUIDE_HAND_TAP_DISTANCE = 14;
const GUIDE_HAND_TAP_CYCLE_MS = 900;
const GUIDE_HAND_REAPPEAR_DELAY_MS = 3000;
const REEL_BUFFER_ROWS = 2;
const REEL_SPRITE_COUNT = REEL_ROWS + REEL_BUFFER_ROWS;
const SPIN_ACCELERATION_MS = 300;
const SPIN_DECELERATION_MS = 600;
const FIRST_REEL_DURATION_MS = 1500;
const REEL_STOP_STAGGER_MS = 300;
const FIRST_REEL_STEPS = 10;
const EXTRA_STEPS_PER_REEL = 3;
const LANDING_BOUNCE_MS = 300;
const LANDING_BOUNCE_DISTANCE = 12;
const BUFFER_FADE_IN_MS = 160;
const BUFFER_FADE_OUT_START = 0.5;
const FRAME_PIN_INSET = 6;
const FRAME_PIN_SPACING = 18;
const FRAME_PIN_RADIUS = 3;
const FRAME_PIN_HIGHLIGHT_RADIUS = 1.35;

interface ReelColumn {
  view: Container;
  sprites: Sprite[];
  offset: number;
}

export function createReelScene(
  symbols: readonly PlayableSymbol[],
  logoTexture: Texture,
  glovePointerTexture: Texture,
  ticker: Ticker,
): Container {
  const scene = new Container();
  const reel = createReelGrid(symbols, ticker);
  reel.view.position.set(0, 30);

  const logo = new Sprite(logoTexture);
  logo.anchor.set(0.5);
  logo.scale.set(330 / logoTexture.width);
  logo.position.set(0, -285);

  const spinGuide = createSpinGuide(glovePointerTexture, ticker);
  const spinButton = createSpinButton(async () => {
    spinGuide.dismiss();

    try {
      await reel.spin();
    } finally {
      spinGuide.scheduleReappearance();
    }
  });
  spinButton.position.set(0, SPIN_BUTTON_Y);

  scene.addChild(logo, reel.view, spinButton, spinGuide.view);
  return scene;
}

function createSpinGuide(
  texture: Texture,
  ticker: Ticker,
): {
  view: Sprite;
  dismiss: () => void;
  scheduleReappearance: () => void;
} {
  const hand = new Sprite(texture);
  const baseScale = GUIDE_HAND_HEIGHT / texture.height;
  let elapsed = 0;
  let isDismissed = false;
  let reappearTimer: number | undefined;

  hand.anchor.set(0.5, 0.955);
  hand.rotation = GUIDE_HAND_ROTATION;
  hand.eventMode = 'none';

  const resetTapAnimation = (): void => {
    elapsed = 0;
    hand.position.set(GUIDE_HAND_TARGET_X, GUIDE_HAND_TARGET_Y);
    hand.scale.set(baseScale);
  };

  resetTapAnimation();

  const animateTap = (activeTicker: Ticker): void => {
    elapsed += activeTicker.deltaMS;

    const cycleProgress =
      (elapsed % GUIDE_HAND_TAP_CYCLE_MS) / GUIDE_HAND_TAP_CYCLE_MS;
    const tapProgress = cycleProgress < 0.55
      ? Math.sin((cycleProgress / 0.55) * Math.PI)
      : 0;

    const tapDistance = tapProgress * GUIDE_HAND_TAP_DISTANCE;
    hand.position.set(
      GUIDE_HAND_TARGET_X - Math.sin(GUIDE_HAND_ROTATION) * tapDistance,
      GUIDE_HAND_TARGET_Y + Math.cos(GUIDE_HAND_ROTATION) * tapDistance,
    );
    hand.scale.set(baseScale * (1 + tapProgress * 0.025));
  };

  ticker.add(animateTap);

  const dismiss = (): void => {
    if (reappearTimer !== undefined) {
      window.clearTimeout(reappearTimer);
      reappearTimer = undefined;
    }

    if (isDismissed) {
      return;
    }

    isDismissed = true;
    ticker.remove(animateTap);
    hand.visible = false;
    resetTapAnimation();
  };

  const scheduleReappearance = (): void => {
    if (reappearTimer !== undefined) {
      window.clearTimeout(reappearTimer);
    }

    reappearTimer = window.setTimeout(() => {
      reappearTimer = undefined;
      isDismissed = false;
      hand.visible = true;
      ticker.add(animateTap);
    }, GUIDE_HAND_REAPPEAR_DELAY_MS);
  };

  return { view: hand, dismiss, scheduleReappearance };
}

function createReelGrid(
  symbols: readonly PlayableSymbol[],
  ticker: Ticker,
): {
  view: Container;
  spin: () => Promise<void>;
} {
  if (symbols.length === 0) {
    throw new Error('The reel requires at least one symbol texture.');
  }

  const grid = new Container();
  const reels: ReelColumn[] = [];
  const initialSymbols = shuffle(symbols);
  let initialSymbolIndex = 0;

  const reelBackground = new Graphics()
    .rect(-GRID_WIDTH * 0.5, -GRID_HEIGHT * 0.5, GRID_WIDTH, GRID_HEIGHT)
    .fill({ color: 0x2b0904 });

  const separators = new Graphics();

  for (let column = 1; column < REEL_COLUMNS; column += 1) {
    const x = REEL_CONTENT_LEFT + column * CELL_WIDTH;
    separators
      .moveTo(x, REEL_CONTENT_TOP)
      .lineTo(x, REEL_CONTENT_TOP + REEL_CONTENT_HEIGHT);
  }

  const separatorGradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 0x7a3506 },
      { offset: 0.3, color: 0xffe98a },
      { offset: 0.6, color: 0xe9a11a },
      { offset: 1, color: 0x8a3d06 },
    ],
    textureSpace: 'local',
  });

  separators.stroke({ fill: separatorGradient, width: 4 });

  const cells = new Container();
  cells.position.set(REEL_CONTENT_LEFT, REEL_CONTENT_TOP);

  for (let column = 0; column < REEL_COLUMNS; column += 1) {
    const reelView = new Container();
    const sprites: Sprite[] = [];
    reelView.position.x = column * CELL_WIDTH;

    for (let index = 0; index < REEL_SPRITE_COUNT; index += 1) {
      const symbol = new Sprite(Texture.EMPTY);
      symbol.anchor.set(0.5);
      symbol.position.x = CELL_WIDTH * 0.5;

      setSymbol(
        symbol,
        initialSymbols[initialSymbolIndex % initialSymbols.length],
      );
      initialSymbolIndex += 1;

      sprites.push(symbol);
      reelView.addChild(symbol);
    }

    const reel: ReelColumn = { view: reelView, sprites, offset: 0 };
    layoutReelSymbols(reel);
    setBufferSymbolsVisible(reel, false);
    reels.push(reel);
    cells.addChild(reelView);
  }

  const cellsMask = new Graphics()
    .rect(
      REEL_CONTENT_LEFT,
      REEL_CONTENT_TOP,
      REEL_CONTENT_WIDTH,
      REEL_CONTENT_HEIGHT,
    )
    .fill({ color: 0xffffff });
  cells.mask = cellsMask;

  const spin = async (): Promise<void> => {
    await Promise.all(
      reels.map((reel, index) =>
        spinReel(reel, index, symbols, ticker),
      ),
    );
  };

  const reelFrame = createReelFrame();

  grid.addChild(reelBackground, cells, cellsMask, separators, reelFrame);
  return { view: grid, spin };
}

function createReelFrame(): Container {
  const frame = new Container();
  const halfWidth = GRID_WIDTH * 0.5;
  const halfHeight = GRID_HEIGHT * 0.5;

  const goldRail = new Graphics()
    .rect(-halfWidth, -halfHeight, GRID_WIDTH, GRID_HEIGHT)
    .stroke({ color: 0xe69a16, width: FRAME_RAIL_WIDTH, alignment: 1 });

  const brightEdge = new Graphics()
    .rect(-halfWidth, -halfHeight, GRID_WIDTH, GRID_HEIGHT)
    .stroke({ color: 0xffd95a, width: 3, alignment: 1 });

  const pins = new Graphics();
  const top = -halfHeight + FRAME_PIN_INSET;
  const bottom = halfHeight - FRAME_PIN_INSET;
  const left = -halfWidth + FRAME_PIN_INSET;
  const right = halfWidth - FRAME_PIN_INSET;

  placePins(left, right, FRAME_PIN_SPACING, (x) => {
    drawFramePin(pins, x, top);
    drawFramePin(pins, x, bottom);
  });

  placePins(top + FRAME_PIN_SPACING, bottom - FRAME_PIN_SPACING, FRAME_PIN_SPACING, (y) => {
    drawFramePin(pins, left, y);
    drawFramePin(pins, right, y);
  });

  frame.addChild(goldRail, brightEdge, pins);
  return frame;
}

function placePins(
  start: number,
  end: number,
  targetSpacing: number,
  placePin: (position: number) => void,
): void {
  const length = end - start;
  const intervals = Math.max(Math.round(length / targetSpacing), 1);

  for (let index = 0; index <= intervals; index += 1) {
    placePin(start + (length * index) / intervals);
  }
}

function drawFramePin(pins: Graphics, x: number, y: number): void {
  pins
    .circle(x, y, FRAME_PIN_RADIUS)
    .fill({ color: 0x7f3608 })
    .circle(x, y, FRAME_PIN_RADIUS - 0.8)
    .fill({ color: 0xf4b52a })
    .circle(x - 0.65, y - 0.65, FRAME_PIN_HIGHLIGHT_RADIUS)
    .fill({ color: 0xffed8a });
}

function createSpinButton(onSpin: () => Promise<void>): Container {
  const button = new Container();
  const halfWidth = SPIN_BUTTON_WIDTH * 0.5;
  const halfHeight = SPIN_BUTTON_HEIGHT * 0.5;
  const innerWidth = SPIN_BUTTON_WIDTH - SPIN_BUTTON_INSET * 2;
  const innerHeight = SPIN_BUTTON_HEIGHT - SPIN_BUTTON_INSET * 2;

  const shadow = new Graphics()
    .roundRect(
      -halfWidth,
      -halfHeight + SPIN_BUTTON_SHADOW_OFFSET,
      SPIN_BUTTON_WIDTH,
      SPIN_BUTTON_HEIGHT - SPIN_BUTTON_SHADOW_OFFSET,
      20,
    )
    .fill({ color: 0x2b0d03 });

  const frame = new Graphics()
    .roundRect(
      -halfWidth,
      -halfHeight,
      SPIN_BUTTON_WIDTH,
      SPIN_BUTTON_HEIGHT,
      20,
    )
    .fill({ color: 0x4b1806 })
    .stroke({ color: 0xf2b84b, width: 6, alignment: 1 });

  const face = new Graphics()
    .roundRect(
      -innerWidth * 0.5,
      -innerHeight * 0.5,
      innerWidth,
      innerHeight,
      14,
    )
    .fill({ color: 0xe8e4d8 })
    .stroke({ color: 0xfff8df, width: 4, alignment: 1 });

  const highlight = new Graphics()
    .roundRect(
      -innerWidth * 0.5 + 6,
      -innerHeight * 0.5 + 6,
      innerWidth - 12,
      innerHeight * 0.42,
      10,
    )
    .fill({ color: 0xffffff });

  const label = new Text({
    text: 'SPIN',
    style: {
      fill: 0x2b1a0d,
      fontFamily: 'Arial, sans-serif',
      fontSize: 44,
      fontWeight: '900',
      letterSpacing: 3,
      stroke: { color: 0xb9a77c, width: 2 },
    },
  });
  label.anchor.set(0.5);

  const releaseButton = (): void => {
    button.scale.set(1);
  };

  let isSpinning = false;

  const runSpin = async (): Promise<void> => {
    if (isSpinning) {
      return;
    }

    isSpinning = true;
    button.eventMode = 'none';
    button.cursor = 'default';
    label.text = 'SPINNING';
    label.style.fontSize = 30;

    try {
      await onSpin();
    } catch (error) {
      console.error('The reel spin could not be completed.', error);
    } finally {
      isSpinning = false;
      button.eventMode = 'static';
      button.cursor = 'pointer';
      label.text = 'SPIN';
      label.style.fontSize = 44;
      releaseButton();
    }
  };

  button.addChild(shadow, frame, face, highlight, label);
  button.hitArea = new Rectangle(
    -halfWidth,
    -halfHeight,
    SPIN_BUTTON_WIDTH,
    SPIN_BUTTON_HEIGHT,
  );
  button.eventMode = 'static';
  button.cursor = 'pointer';
  button.on('pointerdown', () => button.scale.set(SPIN_BUTTON_PRESS_SCALE));
  button.on('pointerup', releaseButton);
  button.on('pointerupoutside', releaseButton);
  button.on('pointerout', releaseButton);
  button.on('pointertap', () => void runSpin());

  return button;
}

function setSymbol(sprite: Sprite, symbol: PlayableSymbol): void {
  sprite.texture = symbol.texture;

  const fitScale = Math.min(
    SYMBOL_SIZE / symbol.texture.width,
    SYMBOL_SIZE / symbol.texture.height,
  );
  sprite.scale.set(fitScale * symbol.scale);
}

function layoutReelSymbols(reel: ReelColumn): void {
  reel.sprites.forEach((sprite, index) => {
    sprite.position.y = (index - 0.5) * CELL_HEIGHT + reel.offset;
  });
}

function setBufferSymbolsVisible(reel: ReelColumn, visible: boolean): void {
  reel.sprites.forEach((sprite, index) => {
    const isBuffer = index === 0 || index === reel.sprites.length - 1;

    if (isBuffer) {
      sprite.visible = visible;
    }
  });
}

function setBufferSymbolsAlpha(reel: ReelColumn, alpha: number): void {
  reel.sprites.forEach((sprite, index) => {
    const isBuffer = index === 0 || index === reel.sprites.length - 1;

    if (isBuffer) {
      sprite.alpha = alpha;
    }
  });
}

function advanceReel(
  reel: ReelColumn,
  distance: number,
  symbols: readonly PlayableSymbol[],
): void {
  reel.offset += distance;

  while (reel.offset >= CELL_HEIGHT - 0.001) {
    reel.offset -= CELL_HEIGHT;

    const recycledSprite = reel.sprites.pop();

    if (!recycledSprite) {
      throw new Error('The reel strip has no symbol to recycle.');
    }

    setSymbol(recycledSprite, randomItem(symbols));
    reel.sprites.unshift(recycledSprite);
  }

  if (Math.abs(reel.offset) < 0.001) {
    reel.offset = 0;
  }

  layoutReelSymbols(reel);
}

async function spinReel(
  reel: ReelColumn,
  reelIndex: number,
  symbols: readonly PlayableSymbol[],
  ticker: Ticker,
): Promise<void> {
  setBufferSymbolsVisible(reel, true);
  setBufferSymbolsAlpha(reel, 0);

  const duration = FIRST_REEL_DURATION_MS + reelIndex * REEL_STOP_STAGGER_MS;
  const steps = FIRST_REEL_STEPS + reelIndex * EXTRA_STEPS_PER_REEL;
  const totalDistance = steps * CELL_HEIGHT;
  let previousDistance = 0;

  await animateWithTicker(ticker, duration, (elapsed) => {
    const currentDistance = getSpinDistance(elapsed, duration, totalDistance);
    advanceReel(reel, currentDistance - previousDistance, symbols);
    setBufferSymbolsAlpha(
      reel,
      smoothStep(Math.min(elapsed / BUFFER_FADE_IN_MS, 1)),
    );
    previousDistance = currentDistance;
  });

  advanceReel(reel, totalDistance - previousDistance, symbols);
  reel.offset = 0;
  layoutReelSymbols(reel);

  await animateWithTicker(ticker, LANDING_BOUNCE_MS, (_, progress) => {
    reel.view.position.y =
      Math.sin(progress * Math.PI) * LANDING_BOUNCE_DISTANCE;

    const fadeProgress = Math.max(
      (progress - BUFFER_FADE_OUT_START) / (1 - BUFFER_FADE_OUT_START),
      0,
    );
    setBufferSymbolsAlpha(reel, 1 - smoothStep(fadeProgress));
  });

  reel.view.position.y = 0;
  setBufferSymbolsVisible(reel, false);
  setBufferSymbolsAlpha(reel, 0);
}

function getSpinDistance(
  elapsed: number,
  duration: number,
  totalDistance: number,
): number {
  const cruiseDuration =
    duration - SPIN_ACCELERATION_MS - SPIN_DECELERATION_MS;
  const velocityProfileArea =
    cruiseDuration + (SPIN_ACCELERATION_MS + SPIN_DECELERATION_MS) * 0.5;
  const maximumSpeed = totalDistance / velocityProfileArea;

  if (elapsed <= SPIN_ACCELERATION_MS) {
    return (
      0.5 *
      (maximumSpeed / SPIN_ACCELERATION_MS) *
      elapsed *
      elapsed
    );
  }

  const accelerationDistance =
    maximumSpeed * SPIN_ACCELERATION_MS * 0.5;

  if (elapsed <= SPIN_ACCELERATION_MS + cruiseDuration) {
    return (
      accelerationDistance +
      maximumSpeed * (elapsed - SPIN_ACCELERATION_MS)
    );
  }

  const decelerationElapsed =
    elapsed - SPIN_ACCELERATION_MS - cruiseDuration;
  const distanceBeforeDeceleration =
    accelerationDistance + maximumSpeed * cruiseDuration;

  return (
    distanceBeforeDeceleration +
    maximumSpeed * decelerationElapsed -
    0.5 *
      (maximumSpeed / SPIN_DECELERATION_MS) *
      decelerationElapsed *
      decelerationElapsed
  );
}

function animateWithTicker(
  ticker: Ticker,
  duration: number,
  update: (elapsed: number, progress: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;

    const tick = (activeTicker: Ticker): void => {
      elapsed = Math.min(elapsed + activeTicker.deltaMS, duration);
      update(elapsed, elapsed / duration);

      if (elapsed >= duration) {
        ticker.remove(tick);
        resolve();
      }
    };

    ticker.add(tick);
  });
}

function randomItem<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
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
