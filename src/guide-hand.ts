import { Sprite, Texture, Ticker } from 'pixi.js';

const GUIDE_HAND_HEIGHT = 240;
const GUIDE_HAND_TARGET_X = 20;
const GUIDE_HAND_TARGET_Y = 30;
const GUIDE_HAND_ROTATION = Math.PI * 0.8;
const GUIDE_HAND_TAP_DISTANCE = 14;
const GUIDE_HAND_TAP_CYCLE_MS = 900;
const GUIDE_HAND_REAPPEAR_DELAY_MS = 3000;

export function createGuideHand(
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
