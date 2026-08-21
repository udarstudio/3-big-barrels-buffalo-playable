import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { createGuideHand } from './guide-hand';
import { createMachineButton } from './machine-button';

const COIN_RAIN_LEAD_IN_MS = 700;
const COIN_FILL_MS = 3500;
const COIN_RESPAWN_STOP_EARLY_MS = 1000;
const COIN_SOUND_DELAY_MS = 900;
const COIN_SOUND_DURATION_MS = 3500;
const COIN_SOUND_FADE_MS = 500;
const END_CARD_REVEAL_MS = 700;
const COIN_COUNT = 100;
const COIN_INITIAL_TRAIL = 560;
const MAX_SHAKE_DISTANCE = 8;
const PORTRAIT_DESIGN = { width: 720, height: 1280 } as const;
const LANDSCAPE_DESIGN = { width: 1280, height: 720 } as const;

interface EndCardLayout {
  coinTexture: Texture;
  visibleWidth: number;
  visibleHeight: number;
  halfHeight: number;
  logoWidth: number;
  logoY: number;
}

interface FallingCoin {
  view: Graphics;
  baseX: number;
  speed: number;
  drift: number;
  phase: number;
  spinSpeed: number;
}

export function createEndCard(
  logoTexture: Texture,
  glovePointerTexture: Texture,
  coinFillPortraitTexture: Texture,
  coinFillLandscapeTexture: Texture,
  ticker: Ticker,
  audio: {
    playButtonClick: () => void;
    playCoinRain: () => void;
    setCoinRainVolume: (volume: number) => void;
    stopCoinRain: () => void;
  },
): {
  view: Container;
  show: (gameplay: Container) => Promise<void>;
} {
  const view = new Container();
  const effects = new Container();
  const rain = createCoinRain();
  const coinPile = new Sprite(Texture.EMPTY);
  const finalUi = new Container();
  const logo = new Sprite(logoTexture);
  const playNow = createMachineButton('PLAY NOW', 38, audio.playButtonClick);
  const playNowGuide = createGuideHand(glovePointerTexture, ticker);
  let hasStarted = false;
  let rainElapsed = 0;

  view.visible = false;

  coinPile.anchor.set(0.5, 1);

  logo.anchor.set(0.5);
  logo.alpha = 0;
  logo.scale.set(0);

  playNow.view.alpha = 0;
  playNow.view.scale.set(0);
  playNow.view.on('pointertap', () => {
    playNowGuide.dismiss();
    openClickThrough();
  });

  playNowGuide.view.visible = false;

  finalUi.addChild(logo, playNow.view, playNowGuide.view);
  effects.addChild(rain.view, coinPile);
  view.addChild(effects, finalUi);

  const updateRain = (activeTicker: Ticker): void => {
    rainElapsed += activeTicker.deltaMS;

    if (!rain.update(activeTicker.deltaMS, rainElapsed)) {
      ticker.remove(updateRain);
    }
  };

  const show = async (gameplay: Container): Promise<void> => {
    if (hasStarted) {
      return;
    }

    hasStarted = true;

    const layout = getEndCardLayout(
      coinFillPortraitTexture,
      coinFillLandscapeTexture,
    );
    const logoScale = layout.logoWidth / logoTexture.width;
    const pileScale = Math.max(
      layout.visibleWidth / layout.coinTexture.width,
      layout.visibleHeight / layout.coinTexture.height,
    );
    const pileBottomY = layout.halfHeight + 20;
    const pileStartY =
      pileBottomY + layout.coinTexture.height * pileScale + 40;
    let hasStartedCoinSound = false;
    let hasStoppedCoinSound = false;
    const coinSoundEnd = COIN_SOUND_DELAY_MS + COIN_SOUND_DURATION_MS;
    const coinSoundFadeStart = coinSoundEnd - COIN_SOUND_FADE_MS;

    const updateCoinSound = (elapsed: number): void => {
      if (!hasStartedCoinSound && elapsed >= COIN_SOUND_DELAY_MS) {
        hasStartedCoinSound = true;
        audio.playCoinRain();
      }

      if (!hasStartedCoinSound || hasStoppedCoinSound) {
        return;
      }

      if (elapsed >= coinSoundEnd) {
        hasStoppedCoinSound = true;
        audio.stopCoinRain();
        return;
      }

      if (elapsed >= coinSoundFadeStart) {
        audio.setCoinRainVolume(
          (coinSoundEnd - elapsed) / COIN_SOUND_FADE_MS,
        );
      }
    };

    coinPile.texture = layout.coinTexture;
    coinPile.scale.set(pileScale);
    coinPile.position.set(0, pileStartY);
    logo.position.set(0, layout.logoY);
    playNow.view.position.set(0, 0);
    rain.configure(layout.visibleWidth, layout.halfHeight);
    rainElapsed = 0;
    view.visible = true;
    ticker.add(updateRain);

    await animateWithTicker(ticker, COIN_RAIN_LEAD_IN_MS, () => undefined);

    await animateWithTicker(ticker, COIN_FILL_MS, (elapsed, progress) => {
      const easedProgress = smoothStep(progress);
      coinPile.position.y =
        pileStartY + (pileBottomY - pileStartY) * easedProgress;

      if (elapsed >= COIN_FILL_MS - COIN_RESPAWN_STOP_EARLY_MS) {
        rain.stopEmitting();
      }

      updateCoinSound(elapsed);

      const shakeStrength =
        Math.sin(progress * Math.PI) * MAX_SHAKE_DISTANCE;
      const shakeX = (Math.random() * 2 - 1) * shakeStrength;
      const shakeY = (Math.random() * 2 - 1) * shakeStrength;
      gameplay.position.set(shakeX, shakeY);
      effects.position.set(shakeX, shakeY);

      const hideProgress = Math.max((progress - 0.62) / 0.28, 0);
      gameplay.alpha = 1 - smoothStep(Math.min(hideProgress, 1));
    });

    rain.stopEmitting();

    gameplay.position.set(0);
    effects.position.set(0);
    gameplay.alpha = 0;
    gameplay.visible = false;

    await animateWithTicker(ticker, END_CARD_REVEAL_MS, (elapsed, progress) => {
      updateCoinSound(COIN_FILL_MS + elapsed);

      const logoProgress = Math.min(progress / 0.7, 1);
      const buttonProgress = Math.min(Math.max((progress - 0.28) / 0.72, 0), 1);
      logo.alpha = smoothStep(logoProgress);
      logo.scale.set(logoScale * easeOutBack(logoProgress));
      playNow.view.alpha = smoothStep(buttonProgress);
      playNow.view.scale.set(easeOutBack(buttonProgress));
      playNowGuide.view.visible = buttonProgress >= 0.5;
    });

    logo.scale.set(logoScale);
    playNow.view.scale.set(1);
    audio.stopCoinRain();
  };

  return { view, show };
}

function createCoinRain(): {
  view: Container;
  configure: (designWidth: number, halfHeight: number) => void;
  stopEmitting: () => void;
  update: (deltaMs: number, elapsedMs: number) => boolean;
} {
  const view = new Container();
  let designWidth = 720;
  let halfHeight = 640;
  let isEmitting = true;
  const coins = Array.from({ length: COIN_COUNT }, (_, index) => {
    const coin = createFallingCoin();
    const scale = 0.65 + Math.random() * 0.65;
    const fallingCoin: FallingCoin = {
      view: coin,
      baseX: -designWidth * 0.55 + Math.random() * designWidth * 1.1,
      speed: 360 + Math.random() * 480,
      drift: 12 + Math.random() * 35,
      phase: Math.random() * Math.PI * 2,
      spinSpeed: 0.004 + Math.random() * 0.008,
    };

    coin.position.set(fallingCoin.baseX, -halfHeight - index * 38);
    coin.scale.set(scale);
    view.addChild(coin);
    return fallingCoin;
  });

  return {
    view,
    configure: (nextDesignWidth: number, nextHalfHeight: number): void => {
      designWidth = nextDesignWidth;
      halfHeight = nextHalfHeight;
      isEmitting = true;
      coins.forEach((coin, index) => {
        coin.baseX = -designWidth * 0.55 + Math.random() * designWidth * 1.1;
        coin.view.position.set(
          coin.baseX,
          -halfHeight - (index / COIN_COUNT) * COIN_INITIAL_TRAIL,
        );
        coin.view.visible = true;
      });
    },
    stopEmitting: (): void => {
      isEmitting = false;
    },
    update: (deltaMs: number, elapsedMs: number): boolean => {
      coins.forEach((coin) => {
        if (!coin.view.visible) {
          return;
        }

        coin.view.position.y += coin.speed * (deltaMs / 1000);
        coin.view.position.x =
          coin.baseX + Math.sin(elapsedMs * 0.002 + coin.phase) * coin.drift;
        coin.view.rotation += coin.spinSpeed * deltaMs;

        if (coin.view.position.y > halfHeight + 70) {
          if (isEmitting) {
            coin.baseX =
              -designWidth * 0.55 + Math.random() * designWidth * 1.1;
            coin.view.position.y = -halfHeight - 40 - Math.random() * 160;
          } else {
            coin.view.visible = false;
          }
        }
      });

      return coins.some((coin) => coin.view.visible);
    },
  };
}

function getEndCardLayout(
  portraitTexture: Texture,
  landscapeTexture: Texture,
): EndCardLayout {
  const isPortrait = window.innerHeight >= window.innerWidth;
  const design = isPortrait ? PORTRAIT_DESIGN : LANDSCAPE_DESIGN;
  const scale = Math.min(
    window.innerWidth / design.width,
    window.innerHeight / design.height,
  );
  const visibleWidth = window.innerWidth / scale;
  const visibleHeight = window.innerHeight / scale;

  return {
    coinTexture: isPortrait ? portraitTexture : landscapeTexture,
    visibleWidth,
    visibleHeight,
    halfHeight: visibleHeight * 0.5,
    logoWidth: isPortrait ? 480 : 440,
    logoY: isPortrait ? -360 : -180,
  };
}

function createFallingCoin(): Graphics {
  return new Graphics()
    .ellipse(0, 0, 14, 9)
    .fill({ color: 0x8c4305 })
    .ellipse(0, -1, 12, 7)
    .fill({ color: 0xffc928 })
    .ellipse(-3, -3, 3, 1.5)
    .fill({ color: 0xffffbd });
}

function openClickThrough(): void {
  const playableWindow = window as Window & {
    clickTag?: string;
    mraid?: { open: (url: string) => void };
  };
  const destination = playableWindow.clickTag;

  window.dispatchEvent(new CustomEvent('playable:cta'));

  if (!destination) {
    return;
  }

  if (playableWindow.mraid) {
    playableWindow.mraid.open(destination);
  } else {
    window.open(destination, '_blank', 'noopener');
  }
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

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function easeOutBack(progress: number): number {
  const overshoot = 1.70158;
  const shifted = progress - 1;
  return 1 + shifted * shifted * ((overshoot + 1) * shifted + overshoot);
}
