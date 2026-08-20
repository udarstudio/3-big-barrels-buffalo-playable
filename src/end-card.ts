import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { createMachineButton } from './machine-button';

const DESIGN_WIDTH = 720;
const DESIGN_HALF_HEIGHT = 640;
const FINAL_WIN_HOLD_MS = 650;
const COIN_FILL_MS = 2600;
const END_CARD_REVEAL_MS = 700;
const COIN_COUNT = 42;
const MAX_SHAKE_DISTANCE = 8;
const FINAL_LOGO_WIDTH = 400;
const FINAL_LOGO_Y = -300;
const PLAY_NOW_Y = -75;

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
  coinPileTexture: Texture,
  ticker: Ticker,
): {
  view: Container;
  show: (gameplay: Container) => Promise<void>;
} {
  const view = new Container();
  const effects = new Container();
  const rain = createCoinRain();
  const coinPile = new Sprite(coinPileTexture);
  const finalUi = new Container();
  const logo = new Sprite(logoTexture);
  const playNow = createMachineButton('PLAY NOW', 38);
  const logoScale = FINAL_LOGO_WIDTH / logoTexture.width;
  const pileScale = DESIGN_WIDTH / coinPileTexture.width;
  const pileBottomY = DESIGN_HALF_HEIGHT + 20;
  const pileStartY = pileBottomY + coinPileTexture.height * pileScale + 40;
  let hasStarted = false;
  let rainElapsed = 0;

  view.visible = false;

  coinPile.anchor.set(0.5, 1);
  coinPile.scale.set(pileScale);
  coinPile.position.set(0, pileStartY);

  logo.anchor.set(0.5);
  logo.position.set(0, FINAL_LOGO_Y);
  logo.alpha = 0;
  logo.scale.set(0);

  playNow.view.position.set(0, PLAY_NOW_Y);
  playNow.view.alpha = 0;
  playNow.view.scale.set(0);
  playNow.view.on('pointertap', openClickThrough);

  finalUi.addChild(logo, playNow.view);
  effects.addChild(rain.view, coinPile);
  view.addChild(effects, finalUi);

  const updateRain = (activeTicker: Ticker): void => {
    rainElapsed += activeTicker.deltaMS;
    rain.update(activeTicker.deltaMS, rainElapsed);
  };

  const show = async (gameplay: Container): Promise<void> => {
    if (hasStarted) {
      return;
    }

    hasStarted = true;
    await animateWithTicker(ticker, FINAL_WIN_HOLD_MS, () => undefined);
    view.visible = true;
    ticker.add(updateRain);

    await animateWithTicker(ticker, COIN_FILL_MS, (_, progress) => {
      const easedProgress = smoothStep(progress);
      coinPile.position.y =
        pileStartY + (pileBottomY - pileStartY) * easedProgress;

      const shakeStrength =
        Math.sin(progress * Math.PI) * MAX_SHAKE_DISTANCE;
      const shakeX = (Math.random() * 2 - 1) * shakeStrength;
      const shakeY = (Math.random() * 2 - 1) * shakeStrength;
      gameplay.position.set(shakeX, shakeY);
      effects.position.set(shakeX, shakeY);

      const hideProgress = Math.max((progress - 0.62) / 0.28, 0);
      gameplay.alpha = 1 - smoothStep(Math.min(hideProgress, 1));
    });

    gameplay.position.set(0);
    effects.position.set(0);
    gameplay.alpha = 0;
    gameplay.visible = false;

    await animateWithTicker(ticker, END_CARD_REVEAL_MS, (_, progress) => {
      const logoProgress = Math.min(progress / 0.7, 1);
      const buttonProgress = Math.min(Math.max((progress - 0.28) / 0.72, 0), 1);
      logo.alpha = smoothStep(logoProgress);
      logo.scale.set(logoScale * easeOutBack(logoProgress));
      playNow.view.alpha = smoothStep(buttonProgress);
      playNow.view.scale.set(easeOutBack(buttonProgress));
    });

    logo.scale.set(logoScale);
    playNow.view.scale.set(1);
  };

  return { view, show };
}

function createCoinRain(): {
  view: Container;
  update: (deltaMs: number, elapsedMs: number) => void;
} {
  const view = new Container();
  const coins = Array.from({ length: COIN_COUNT }, (_, index) => {
    const coin = createFallingCoin();
    const scale = 0.65 + Math.random() * 0.65;
    const fallingCoin: FallingCoin = {
      view: coin,
      baseX: -DESIGN_WIDTH * 0.55 + Math.random() * DESIGN_WIDTH * 1.1,
      speed: 360 + Math.random() * 480,
      drift: 12 + Math.random() * 35,
      phase: Math.random() * Math.PI * 2,
      spinSpeed: 0.004 + Math.random() * 0.008,
    };

    coin.position.set(fallingCoin.baseX, -DESIGN_HALF_HEIGHT - index * 38);
    coin.scale.set(scale);
    view.addChild(coin);
    return fallingCoin;
  });

  return {
    view,
    update: (deltaMs: number, elapsedMs: number): void => {
      coins.forEach((coin) => {
        coin.view.position.y += coin.speed * (deltaMs / 1000);
        coin.view.position.x =
          coin.baseX + Math.sin(elapsedMs * 0.002 + coin.phase) * coin.drift;
        coin.view.rotation += coin.spinSpeed * deltaMs;

        if (coin.view.position.y > DESIGN_HALF_HEIGHT + 70) {
          coin.baseX = -DESIGN_WIDTH * 0.55 + Math.random() * DESIGN_WIDTH * 1.1;
          coin.view.position.y = -DESIGN_HALF_HEIGHT - 40 - Math.random() * 320;
        }
      });
    },
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
