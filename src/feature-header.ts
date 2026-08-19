import { Sprite, Texture } from 'pixi.js';

const FEATURE_HEADER_WIDTH = 570;

export function createFeatureHeader(texture: Texture): Sprite {
  const header = new Sprite(texture);
  header.anchor.set(0.5);
  header.scale.set(FEATURE_HEADER_WIDTH / texture.width);
  return header;
}
