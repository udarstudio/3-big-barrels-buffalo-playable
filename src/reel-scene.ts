import {
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  Ticker,
} from 'pixi.js';
import { createPlayableAudio } from './audio';
import { createCoinBurst } from './coin-burst';
import { createEndCard } from './end-card';
import { createFeatureHeader } from './feature-header';
import { createGuideHand } from './guide-hand';
import { createMachineButton } from './machine-button';
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
const SPIN_BUTTON_Y = 315;
const LOGO_WIDTH = 280;
const LOGO_Y = -520;
const FEATURE_HEADER_Y = -295;
const REEL_Y = 0;
const LANDSCAPE_MACHINE_X = -280;
const LANDSCAPE_REEL_Y = 95;
const LANDSCAPE_FEATURE_HEADER_Y = LANDSCAPE_REEL_Y + FEATURE_HEADER_Y;
const LANDSCAPE_BRAND_X = 370;
const LANDSCAPE_LOGO_WIDTH = 330;
const LANDSCAPE_LOGO_Y = -155;
const LANDSCAPE_SPIN_BUTTON_Y = 125;
const FEATURE_POT_TARGET_Y = FEATURE_HEADER_Y - REEL_Y + 40;
const FEATURE_POT_TARGETS = [-130, 0, 130].map((x) => ({
  x,
  y: FEATURE_POT_TARGET_Y,
}));
const WIN_ANIMATION_FRAME_MS = 70;
const WIN_ANIMATION_PAUSE_MS = 400;
const BUFFALO_SYMBOL_ID = '09_Buffalo';
const WILD_SYMBOL_ID = '01_WILD';
const WOLF_SYMBOL_ID = '12_Wolf';
const WILD_ROCK_ANGLE = Math.PI / 18;
const REEL_BUFFER_ROWS = 2;
const REEL_SPRITE_COUNT = REEL_ROWS + REEL_BUFFER_ROWS;
const SPIN_ACCELERATION_MS = 300;
const SPIN_DECELERATION_MS = 600;
const LATE_REEL_ACCELERATION_MS = 150;
const LATE_REEL_DECELERATION_MS = 300;
const FIRST_REEL_DURATION_MS = 1500;
const BASE_REEL_STOP_GAP_MS = 500;
const FIRST_REEL_STEPS = 10;
const REEL_SPEED_INCREASE_PER_COLUMN = 0.1;
const REEL_STOP_PITCHES = [0.7, 0.7, 0.85, 1] as const;
const WINNING_FINAL_REEL_PITCH = 1.2;
const REEL_SPIN_TENSION_RATES = [1, 1.02, 1.05, 1.09] as const;
const LANDING_BOUNCE_MS = 300;
const LANDING_BOUNCE_DISTANCE = 12;
const BUFFER_FADE_IN_MS = 160;
const BUFFER_FADE_OUT_START = 0.5;
const FRAME_PIN_INSET = 6;
const FRAME_PIN_SPACING = 18;
const FRAME_PIN_RADIUS = 3;
const FRAME_PIN_HIGHLIGHT_RADIUS = 1.35;
const SMALL_WIN_LAYOUT = [
  ['15_A', '12_Wolf', '18_J'],
  ['11_Cougar', '12_Wolf', '10_Bear'],
  ['14_Snake', '12_Wolf', '17_Q'],
  ['16_K', '12_Wolf', '13_Eagle'],
  ['13_Eagle', '11_Cougar', '19_10'],
] as const;
const BIG_WIN_LAYOUT = [
  ['09_Buffalo', '09_Buffalo', '09_Buffalo'],
  ['01_WILD', '01_WILD', '01_WILD'],
  ['01_WILD', '01_WILD', '01_WILD'],
  ['09_Buffalo', '09_Buffalo', '09_Buffalo'],
  ['09_Buffalo', '09_Buffalo', '09_Buffalo'],
] as const;

interface ReelColumn {
  view: Container;
  sprites: Sprite[];
  offset: number;
}

interface AnimatedCell {
  reelIndex: number;
  rowIndex: number;
}

interface SpinSegment {
  duration: number;
  startSpeed: number;
  endSpeed: number;
}

interface WinDecoration {
  above: Container;
  behind: Container;
  update: (elapsedMs: number, cycleDurationMs: number) => void;
  destroy: () => void;
}

export interface ReelScene extends Container {
  layoutForOrientation: (isPortrait: boolean) => void;
}

export function createReelScene(
  symbols: readonly PlayableSymbol[],
  logoTexture: Texture,
  glovePointerTexture: Texture,
  wolfHowlSheetTexture: Texture,
  buffaloVictorySheetTexture: Texture,
  featureMachinesTexture: Texture,
  winGlowTexture: Texture,
  coinFillPortraitTexture: Texture,
  coinFillLandscapeTexture: Texture,
  ticker: Ticker,
): ReelScene {
  const scene = new Container() as ReelScene;
  const gameplay = new Container();
  const audio = createPlayableAudio();
  const endCard = createEndCard(
    logoTexture,
    glovePointerTexture,
    coinFillPortraitTexture,
    coinFillLandscapeTexture,
    ticker,
    {
      playButtonClick: audio.playButtonClick,
      playCoinRain: audio.playCoinRain,
      setCoinRainVolume: audio.setCoinRainVolume,
      stopCoinRain: audio.stopCoinRain,
    },
  );
  const reel = createReelGrid(
    symbols,
    wolfHowlSheetTexture,
    buffaloVictorySheetTexture,
    winGlowTexture,
    ticker,
    (stopPitch, reelIndex) => {
      audio.playReelStop(stopPitch);

      const tensionRate =
        REEL_SPIN_TENSION_RATES[reelIndex] ??
        REEL_SPIN_TENSION_RATES[REEL_SPIN_TENSION_RATES.length - 1];
      audio.setReelSpinRate(tensionRate);
    },
  );
  reel.view.position.set(0, REEL_Y);

  const logo = new Sprite(logoTexture);
  logo.anchor.set(0.5);
  logo.scale.set(LOGO_WIDTH / logoTexture.width);
  logo.position.set(0, LOGO_Y);

  const featureHeader = createFeatureHeader(featureMachinesTexture);
  featureHeader.position.set(0, FEATURE_HEADER_Y);

  const spinGuide = createGuideHand(glovePointerTexture, ticker);
  const spinButton = createSpinButton(
    async () => {
      spinGuide.dismiss();
      audio.startMusic();
      audio.playReelSpin();
      let isComplete = false;

      try {
        isComplete = await reel.spin();

        if (isComplete) {
          audio.playBigWinBell();
          audio.playBuffaloWin();
          void endCard.show(gameplay);
        } else {
          audio.playWolfWin();
        }

        return isComplete;
      } finally {
        audio.stopReelSpin();

        if (!isComplete) {
          spinGuide.scheduleReappearance();
        }
      }
    },
    audio.playButtonClick,
  );
  const controls = new Container();
  controls.addChild(spinButton, spinGuide.view);

  scene.layoutForOrientation = (isPortrait: boolean): void => {
    if (isPortrait) {
      logo.scale.set(LOGO_WIDTH / logoTexture.width);
      logo.position.set(0, LOGO_Y);
      featureHeader.position.set(0, FEATURE_HEADER_Y);
      reel.view.position.set(0, REEL_Y);
      controls.position.set(0, SPIN_BUTTON_Y);
      return;
    }

    logo.scale.set(LANDSCAPE_LOGO_WIDTH / logoTexture.width);
    logo.position.set(LANDSCAPE_BRAND_X, LANDSCAPE_LOGO_Y);
    featureHeader.position.set(
      LANDSCAPE_MACHINE_X,
      LANDSCAPE_FEATURE_HEADER_Y,
    );
    reel.view.position.set(LANDSCAPE_MACHINE_X, LANDSCAPE_REEL_Y);
    controls.position.set(LANDSCAPE_BRAND_X, LANDSCAPE_SPIN_BUTTON_Y);
  };

  scene.layoutForOrientation(window.innerHeight >= window.innerWidth);

  gameplay.addChild(logo, featureHeader, reel.view, controls);
  scene.addChild(gameplay, endCard.view);
  return scene;
}

function createReelGrid(
  symbols: readonly PlayableSymbol[],
  wolfHowlSheetTexture: Texture,
  buffaloVictorySheetTexture: Texture,
  winGlowTexture: Texture,
  ticker: Ticker,
  onReelStop: (playbackRate: number, reelIndex: number) => void,
): {
  view: Container;
  spin: () => Promise<boolean>;
} {
  if (symbols.length === 0) {
    throw new Error('The reel requires at least one symbol texture.');
  }

  const grid = new Container();
  const reels: ReelColumn[] = [];
  const buffaloSymbol = getSymbolById(symbols, BUFFALO_SYMBOL_ID);
  const wolfSymbol = getSymbolById(symbols, WOLF_SYMBOL_ID);
  const buffaloVictoryFrames = createAnimationFrames(buffaloVictorySheetTexture);
  const wolfHowlFrames = createAnimationFrames(wolfHowlSheetTexture);
  const outcomeLayouts = [
    resolveSymbolLayout(SMALL_WIN_LAYOUT, symbols),
    resolveSymbolLayout(BIG_WIN_LAYOUT, symbols),
  ];
  const initialSymbols = shuffle(symbols);
  let initialSymbolIndex = 0;
  let spinIndex = 0;
  let stopWinAnimation: (() => void) | undefined;

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
      { offset: 0.7, color: 0xffe98a },
      { offset: 1, color: 0x7a3506 },
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
  const winOverlay = new Container();

  const spin = async (): Promise<boolean> => {
    stopWinAnimation?.();
    stopWinAnimation = undefined;

    const outcomeIndex = Math.min(spinIndex, outcomeLayouts.length - 1);
    const targetLayout = outcomeLayouts[outcomeIndex];
    const hasWinningFinalReel = outcomeIndex === outcomeLayouts.length - 1;

    await Promise.all(
      reels.map((reel, index) =>
        spinReel(
          reel,
          index,
          symbols,
          targetLayout[index],
          ticker,
          () => onReelStop(
            getReelStopPitch(index, hasWinningFinalReel),
            index,
          ),
        ),
      ),
    );

    if (outcomeIndex === 0) {
      stopWinAnimation = startSymbolWinAnimation(
        reels,
        wolfSymbol,
        wolfHowlFrames,
        findSymbolCells(targetLayout, WOLF_SYMBOL_ID),
        winOverlay,
        ticker,
        () => createWolfWinDecoration(winGlowTexture),
      );
    } else {
      stopWinAnimation = startSymbolWinAnimation(
        reels,
        buffaloSymbol,
        buffaloVictoryFrames,
        findSymbolCells(targetLayout, BUFFALO_SYMBOL_ID),
        winOverlay,
        ticker,
        () => createBuffaloWinDecoration(winGlowTexture),
        findSymbolCells(targetLayout, WILD_SYMBOL_ID),
        false,
      );
    }

    spinIndex += 1;
    return spinIndex >= outcomeLayouts.length;
  };

  const reelFrame = createReelFrame();

  grid.addChild(
    reelBackground,
    cells,
    cellsMask,
    separators,
    reelFrame,
    winOverlay,
  );
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

function createSpinButton(
  onSpin: () => Promise<boolean>,
  playButtonClick: () => void,
): Container {
  const button = createMachineButton('SPIN', 44, playButtonClick);
  let isSpinning = false;
  let isPermanentlyDisabled = false;

  const runSpin = async (): Promise<void> => {
    if (isSpinning || isPermanentlyDisabled) {
      return;
    }

    isSpinning = true;
    button.setDisabled(true);

    try {
      isPermanentlyDisabled = await onSpin();
    } catch (error) {
      console.error('The reel spin could not be completed.', error);
    } finally {
      isSpinning = false;
      button.setDisabled(isPermanentlyDisabled);
      button.view.scale.set(1);
    }
  };

  button.view.on('pointertap', () => void runSpin());

  return button.view;
}

function setSymbol(sprite: Sprite, symbol: PlayableSymbol): void {
  setSpriteTexture(sprite, symbol.texture, symbol.scale);
}

function setSpriteTexture(
  sprite: Sprite,
  texture: Texture,
  scaleMultiplier = 1,
): void {
  sprite.texture = texture;

  const fitScale = Math.min(
    SYMBOL_SIZE / texture.width,
    SYMBOL_SIZE / texture.height,
  );
  sprite.scale.set(fitScale * scaleMultiplier);
}

function createAnimationFrames(sheet: Texture): Texture[] {
  const columns = 3;
  const rows = 3;
  const sourceFrameWidth = sheet.width / columns;
  const sourceFrameHeight = sheet.height / rows;

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return new Texture({
      source: sheet.source,
      frame: new Rectangle(
        column * sourceFrameWidth,
        row * sourceFrameHeight,
        sourceFrameWidth,
        sourceFrameHeight,
      ),
    });
  });
}

function createWolfWinDecoration(glowTexture: Texture): WinDecoration {
  return createWinDecoration({
    glowTexture,
    glowColor: 0x62ff45,
    borderColors: [0xfff3a1, 0xbfff68, 0x38d83f],
  });
}

function createBuffaloWinDecoration(glowTexture: Texture): WinDecoration {
  return createWinDecoration({
    glowTexture,
    glowColor: 0xff8a1f,
    borderColors: [0xffffbd, 0xffbd3c, 0xf05a19],
  });
}

function createWinDecoration({
  glowTexture,
  glowColor,
  borderColors,
}: {
  glowTexture: Texture;
  glowColor: number;
  borderColors: readonly [number, number, number];
}): WinDecoration {
  const behind = new Container();
  const above = new Container();
  const halfSize = SYMBOL_SIZE * 0.5;
  const glow = new Sprite(glowTexture);
  glow.anchor.set(0.5);
  glow.tint = glowColor;
  glow.width = SYMBOL_SIZE * 1.8;
  glow.height = SYMBOL_SIZE * 1.8;
  glow.blendMode = 'add';

  const borderGradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: borderColors[0] },
      { offset: 0.45, color: borderColors[1] },
      { offset: 1, color: borderColors[2] },
    ],
    textureSpace: 'local',
  });
  const borderSize = SYMBOL_SIZE + 2;
  const borderGradientLayer = new Graphics()
    .rect(
      -borderSize * Math.SQRT2 * 0.5,
      -borderSize * Math.SQRT2 * 0.5,
      borderSize * Math.SQRT2,
      borderSize * Math.SQRT2,
    )
    .fill({ fill: borderGradient });
  const borderMask = new Graphics()
    .rect(-halfSize - 1, -halfSize - 1, borderSize, borderSize)
    .stroke({ color: 0xffffff, width: 5, alignment: 1 });
  borderGradientLayer.mask = borderMask;

  behind.addChild(glow);
  above.addChild(borderGradientLayer, borderMask);

  return {
    above,
    behind,
    update: (elapsedMs: number, cycleDurationMs: number): void => {
      const pulse =
        (Math.sin((elapsedMs / cycleDurationMs) * Math.PI * 2) + 1) * 0.5;
      glow.alpha = 0.25 + pulse * 0.75;
      borderGradientLayer.rotation =
        (elapsedMs / cycleDurationMs) * Math.PI * 2;
    },
    destroy: (): void => {
      borderGradient.destroy();
    },
  };
}

function startSymbolWinAnimation(
  reels: readonly ReelColumn[],
  symbol: PlayableSymbol,
  frames: readonly Texture[],
  animatedCells: readonly AnimatedCell[],
  winOverlay: Container,
  ticker: Ticker,
  createDecoration?: () => WinDecoration,
  rockingCells: readonly AnimatedCell[] = [],
  showCoinBurst = true,
): () => void {
  const winningSprites = animatedCells.map(
    ({ reelIndex, rowIndex }) => reels[reelIndex].sprites[rowIndex + 1],
  );
  const rockingSprites = rockingCells.map(
    ({ reelIndex, rowIndex }) => reels[reelIndex].sprites[rowIndex + 1],
  );
  const coinBurst = showCoinBurst
    ? createCoinBurst(
        [...animatedCells, ...rockingCells].map(({ reelIndex, rowIndex }) => ({
          x: REEL_CONTENT_LEFT + (reelIndex + 0.5) * CELL_WIDTH,
          y: REEL_CONTENT_TOP + (rowIndex + 0.5) * CELL_HEIGHT,
        })),
        FEATURE_POT_TARGETS,
      )
    : undefined;

  if (coinBurst) {
    winOverlay.addChild(coinBurst.view);
  }
  const animatedOverlays = winningSprites.map((sprite, index) => {
    const { reelIndex, rowIndex } = animatedCells[index];
    const overlay = new Container();
    const overlaySprite = new Sprite(frames[0]);
    overlaySprite.anchor.set(0.5);
    overlay.position.set(
      REEL_CONTENT_LEFT + (reelIndex + 0.5) * CELL_WIDTH,
      REEL_CONTENT_TOP + (rowIndex + 0.5) * CELL_HEIGHT,
    );
    overlay.addChild(overlaySprite);

    const decoration = createDecoration?.();

    if (decoration) {
      overlay.addChildAt(decoration.behind, 0);
      overlay.addChild(decoration.above);
    }

    sprite.visible = false;
    winOverlay.addChild(overlay);
    return { decoration, overlay, sprite: overlaySprite };
  });
  const pingPongFrameCount = frames.length * 2;
  const animationDuration = pingPongFrameCount * WIN_ANIMATION_FRAME_MS;
  const cycleDuration = animationDuration + WIN_ANIMATION_PAUSE_MS;
  let elapsed = 0;
  let effectElapsed = 0;
  let displayedFrame = -1;

  const showFrame = (frameIndex: number): void => {
    if (frameIndex === displayedFrame) {
      return;
    }

    displayedFrame = frameIndex;
    animatedOverlays.forEach(({ sprite }) => {
      setSpriteTexture(sprite, frames[frameIndex]);
    });
  };

  const animateHowl = (activeTicker: Ticker): void => {
    elapsed = (elapsed + activeTicker.deltaMS) % cycleDuration;
    effectElapsed += activeTicker.deltaMS;
    animatedOverlays.forEach(({ decoration }) => {
      decoration?.update(effectElapsed, cycleDuration);
    });
    rockingSprites.forEach((sprite) => {
      sprite.rotation =
        Math.sin((effectElapsed / cycleDuration) * Math.PI * 2) *
        WILD_ROCK_ANGLE;
    });
    coinBurst?.update(effectElapsed);

    const animationIndex = elapsed < animationDuration
      ? Math.floor(elapsed / WIN_ANIMATION_FRAME_MS)
      : 0;
    const frameIndex = animationIndex < frames.length
      ? animationIndex
      : pingPongFrameCount - animationIndex - 1;

    showFrame(frameIndex);
  };

  showFrame(0);
  animatedOverlays.forEach(({ decoration }) =>
    decoration?.update(0, cycleDuration),
  );
  ticker.add(animateHowl);

  return () => {
    ticker.remove(animateHowl);
    if (coinBurst) {
      winOverlay.removeChild(coinBurst.view);
      coinBurst.destroy();
    }
    animatedOverlays.forEach(({ decoration, overlay }) => {
      winOverlay.removeChild(overlay);
      overlay.destroy({ children: true });
      decoration?.destroy();
    });
    winningSprites.forEach((sprite) => {
      setSymbol(sprite, symbol);
      sprite.visible = true;
    });
    rockingSprites.forEach((sprite) => {
      sprite.rotation = 0;
    });
  };
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
  getNextSymbol: () => PlayableSymbol,
): void {
  reel.offset += distance;

  while (reel.offset >= CELL_HEIGHT - 0.001) {
    reel.offset -= CELL_HEIGHT;

    const recycledSprite = reel.sprites.pop();

    if (!recycledSprite) {
      throw new Error('The reel strip has no symbol to recycle.');
    }

    setSymbol(recycledSprite, getNextSymbol());
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
  targetSymbols: readonly PlayableSymbol[],
  ticker: Ticker,
  onStop: () => void,
): Promise<void> {
  setBufferSymbolsVisible(reel, true);
  setBufferSymbolsAlpha(reel, 0);

  const cumulativeStopGap = (reelIndex * (reelIndex + 1)) / 2;
  const duration =
    FIRST_REEL_DURATION_MS +
    cumulativeStopGap * BASE_REEL_STOP_GAP_MS;
  const spinProfile = createSpinProfile(reelIndex, duration);
  const steps = Math.round(spinProfile.totalDistance / CELL_HEIGHT);
  const totalDistance = steps * CELL_HEIGHT;
  let previousDistance = 0;
  let completedSteps = 0;

  const getNextSymbol = (): PlayableSymbol => {
    completedSteps += 1;

    const remainingSteps = steps - completedSteps;
    const targetRow = remainingSteps - 1;

    return targetSymbols[targetRow] ?? randomItem(symbols);
  };

  await animateWithTicker(ticker, duration, (elapsed) => {
    const currentDistance = spinProfile.getDistance(elapsed, totalDistance);
    advanceReel(reel, currentDistance - previousDistance, getNextSymbol);
    setBufferSymbolsAlpha(
      reel,
      smoothStep(Math.min(elapsed / BUFFER_FADE_IN_MS, 1)),
    );
    previousDistance = currentDistance;
  });

  advanceReel(reel, totalDistance - previousDistance, getNextSymbol);
  reel.offset = 0;
  layoutReelSymbols(reel);
  onStop();

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

function getReelStopPitch(
  reelIndex: number,
  hasWinningFinalReel: boolean,
): number {
  if (reelIndex === REEL_COLUMNS - 1) {
    return hasWinningFinalReel
      ? WINNING_FINAL_REEL_PITCH
      : REEL_STOP_PITCHES[0];
  }

  return REEL_STOP_PITCHES[reelIndex] ?? REEL_STOP_PITCHES[0];
}

function createSpinProfile(
  reelIndex: number,
  duration: number,
): {
  totalDistance: number;
  getDistance: (elapsed: number, targetDistance: number) => number;
} {
  const firstReelVelocityArea =
    FIRST_REEL_DURATION_MS -
    (SPIN_ACCELERATION_MS + SPIN_DECELERATION_MS) * 0.5;
  const baseSpeed =
    (FIRST_REEL_STEPS * CELL_HEIGHT) / firstReelVelocityArea;
  const segments: SpinSegment[] = [
    {
      duration: SPIN_ACCELERATION_MS,
      startSpeed: 0,
      endSpeed: baseSpeed,
    },
  ];
  let landingDuration = SPIN_DECELERATION_MS;

  if (reelIndex < 2) {
    segments.push(
      {
        duration: duration - SPIN_ACCELERATION_MS - SPIN_DECELERATION_MS,
        startSpeed: baseSpeed,
        endSpeed: baseSpeed,
      },
      {
        duration: SPIN_DECELERATION_MS,
        startSpeed: baseSpeed,
        endSpeed: 0,
      },
    );
  } else {
    const speedUpStart = FIRST_REEL_DURATION_MS + BASE_REEL_STOP_GAP_MS;
    const boostedSpeed =
      baseSpeed * (1 + reelIndex * REEL_SPEED_INCREASE_PER_COLUMN);
    landingDuration = LATE_REEL_DECELERATION_MS;
    segments.push(
      {
        duration: speedUpStart - SPIN_ACCELERATION_MS,
        startSpeed: baseSpeed,
        endSpeed: baseSpeed,
      },
      {
        duration: LATE_REEL_ACCELERATION_MS,
        startSpeed: baseSpeed,
        endSpeed: boostedSpeed,
      },
      {
        duration:
          duration -
          speedUpStart -
          LATE_REEL_ACCELERATION_MS -
          LATE_REEL_DECELERATION_MS,
        startSpeed: boostedSpeed,
        endSpeed: boostedSpeed,
      },
      {
        duration: LATE_REEL_DECELERATION_MS,
        startSpeed: boostedSpeed,
        endSpeed: 0,
      },
    );
  }

  const getRawDistance = (elapsed: number): number => {
    let remainingTime = elapsed;
    let distance = 0;

    for (const segment of segments) {
      const segmentTime = Math.min(Math.max(remainingTime, 0), segment.duration);
      const acceleration =
        (segment.endSpeed - segment.startSpeed) / segment.duration;
      distance +=
        segment.startSpeed * segmentTime +
        0.5 * acceleration * segmentTime * segmentTime;
      remainingTime -= segmentTime;

      if (remainingTime <= 0) {
        break;
      }
    }

    return distance;
  };

  const totalDistance = getRawDistance(duration);
  const landingStart = duration - landingDuration;

  return {
    totalDistance,
    getDistance: (elapsed: number, targetDistance: number): number => {
      const landingProgress = Math.min(
        Math.max((elapsed - landingStart) / landingDuration, 0),
        1,
      );
      const landingCorrection = targetDistance - totalDistance;

      return (
        getRawDistance(elapsed) +
        landingCorrection * smoothStep(landingProgress)
      );
    },
  };
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

function getSymbolById(
  symbols: readonly PlayableSymbol[],
  symbolId: string,
): PlayableSymbol {
  const symbol = symbols.find(({ id }) => id === symbolId);

  if (!symbol) {
    throw new Error(`The playable references missing symbol "${symbolId}".`);
  }

  return symbol;
}

function resolveSymbolLayout(
  layout: readonly (readonly string[])[],
  symbols: readonly PlayableSymbol[],
): PlayableSymbol[][] {
  if (layout.length !== REEL_COLUMNS) {
    throw new Error(`A reel outcome requires exactly ${REEL_COLUMNS} columns.`);
  }

  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));

  return layout.map((column) => {
    if (column.length !== REEL_ROWS) {
      throw new Error(`Each reel outcome column requires ${REEL_ROWS} rows.`);
    }

    return column.map((symbolId) => {
      const symbol = symbolsById.get(symbolId);

      if (!symbol) {
        throw new Error(`The reel outcome references missing symbol "${symbolId}".`);
      }

      return symbol;
    });
  });
}

function findSymbolCells(
  layout: readonly (readonly PlayableSymbol[])[],
  symbolId: string,
): AnimatedCell[] {
  const cells: AnimatedCell[] = [];

  layout.forEach((column, reelIndex) => {
    column.forEach((symbol, rowIndex) => {
      if (symbol.id === symbolId) {
        cells.push({ reelIndex, rowIndex });
      }
    });
  });

  return cells;
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
