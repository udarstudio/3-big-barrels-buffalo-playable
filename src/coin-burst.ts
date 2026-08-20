import { Container, Graphics } from 'pixi.js';

const COINS_PER_CELL = 5;
const COIN_FLIGHT_MS = 850;
const COIN_STAGGER_MS = 55;
const COIN_ARC_HEIGHT = 110;

interface Point {
  x: number;
  y: number;
}

interface FlyingCoin {
  view: Graphics;
  start: Point;
  target: Point;
  delay: number;
  curve: number;
}

export function createCoinBurst(
  starts: readonly Point[],
  targets: readonly Point[],
): {
  view: Container;
  update: (elapsedMs: number) => void;
  destroy: () => void;
} {
  const view = new Container();
  const coins: FlyingCoin[] = [];

  starts.forEach((start, cellIndex) => {
    for (let coinIndex = 0; coinIndex < COINS_PER_CELL; coinIndex += 1) {
      const flightIndex = cellIndex * COINS_PER_CELL + coinIndex;
      const coin = createCoin();

      coins.push({
        view: coin,
        start,
        target: targets[flightIndex % targets.length],
        delay: flightIndex * COIN_STAGGER_MS,
        curve: flightIndex % 2 === 0 ? -35 : 35,
      });
      view.addChild(coin);
    }
  });

  const update = (elapsedMs: number): void => {
    coins.forEach(({ view: coin, start, target, delay, curve }) => {
      const progress = Math.min(
        Math.max((elapsedMs - delay) / COIN_FLIGHT_MS, 0),
        1,
      );
      coin.visible = progress > 0 && progress < 1;

      if (!coin.visible) {
        return;
      }

      const arc = Math.sin(progress * Math.PI);
      coin.position.set(
        start.x + (target.x - start.x) * progress + arc * curve,
        start.y + (target.y - start.y) * progress - arc * COIN_ARC_HEIGHT,
      );
      coin.rotation = progress * Math.PI * 4;
      coin.scale.set(0.8 + arc * 0.25);
      coin.scale.x *= 0.25 + Math.abs(Math.cos(progress * Math.PI * 6)) * 0.75;
      coin.alpha = progress > 0.85 ? (1 - progress) / 0.15 : 1;
    });
  };

  update(0);

  return {
    view,
    update,
    destroy: () => view.destroy({ children: true }),
  };
}

function createCoin(): Graphics {
  return new Graphics()
    .circle(0, 0, 8)
    .fill({ color: 0x8b4305 })
    .circle(0, 0, 6.5)
    .fill({ color: 0xffc928 })
    .circle(-2, -2, 2)
    .fill({ color: 0xffffbd });
}
