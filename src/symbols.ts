import { Assets, Texture } from 'pixi.js';
import logoUrl from '../assets/runtime/ui/game-logo.png?url';

const symbolAssetModules = import.meta.glob<string>(
  '../assets/runtime/symbols/*.png',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
);

const symbolUrls = Object.entries(symbolAssetModules)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([, url]) => url);

export interface PlayableTextures {
  logo: Texture;
  symbols: Texture[];
}

export async function loadPlayableTextures(): Promise<PlayableTextures> {
  await Assets.load([...symbolUrls, logoUrl]);

  return {
    logo: Texture.from(logoUrl),
    symbols: symbolUrls.map((url) => Texture.from(url)),
  };
}
