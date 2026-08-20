import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import buttonClickUrl from '../assets/runtime/audio/button-click.mp3?url';

const BUTTON_WIDTH = 300;
const BUTTON_HEIGHT = 100;
const BUTTON_INSET = 10;
const BUTTON_SHADOW_OFFSET = 8;
const BUTTON_PRESS_SCALE = 0.96;
const BUTTON_CLICK_VOLUME = 0.65;
let buttonClick: HTMLAudioElement | undefined;

export interface MachineButton {
  view: Container;
  setDisabled: (isDisabled: boolean) => void;
}

export function createMachineButton(
  text: string,
  fontSize = 44,
): MachineButton {
  const view = new Container();
  const halfWidth = BUTTON_WIDTH * 0.5;
  const halfHeight = BUTTON_HEIGHT * 0.5;
  const innerWidth = BUTTON_WIDTH - BUTTON_INSET * 2;
  const innerHeight = BUTTON_HEIGHT - BUTTON_INSET * 2;

  const shadow = new Graphics()
    .roundRect(
      -halfWidth,
      -halfHeight + BUTTON_SHADOW_OFFSET,
      BUTTON_WIDTH,
      BUTTON_HEIGHT - BUTTON_SHADOW_OFFSET,
      20,
    )
    .fill({ color: 0x2b0d03 });

  const frame = new Graphics()
    .roundRect(-halfWidth, -halfHeight, BUTTON_WIDTH, BUTTON_HEIGHT, 20)
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
    text,
    style: {
      fill: 0x2b1a0d,
      fontFamily: 'Roboto Slab, Georgia, serif',
      fontSize,
      fontWeight: '800',
      letterSpacing: 2,
      stroke: { color: 0xb9a77c, width: 2 },
    },
  });
  label.anchor.set(0.5);

  const release = (): void => {
    view.scale.set(1);
  };

  view.addChild(shadow, frame, face, highlight, label);
  view.hitArea = new Rectangle(
    -halfWidth,
    -halfHeight,
    BUTTON_WIDTH,
    BUTTON_HEIGHT,
  );
  view.eventMode = 'static';
  view.cursor = 'pointer';
  view.on('pointerdown', () => {
    playButtonClick();
    view.scale.set(BUTTON_PRESS_SCALE);
  });
  view.on('pointerup', release);
  view.on('pointerupoutside', release);
  view.on('pointerout', release);

  return {
    view,
    setDisabled: (isDisabled: boolean): void => {
      view.eventMode = isDisabled ? 'none' : 'static';
      view.cursor = isDisabled ? 'default' : 'pointer';
      view.tint = isDisabled ? 0xc8c8c8 : 0xffffff;
    },
  };
}

function playButtonClick(): void {
  buttonClick ??= new Audio(buttonClickUrl);
  buttonClick.volume = BUTTON_CLICK_VOLUME;
  buttonClick.currentTime = 0;

  void buttonClick.play().catch(() => {
    // Some preview environments block sound until the first user gesture.
  });
}
