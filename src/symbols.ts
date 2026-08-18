import { Assets, Texture } from 'pixi.js';
import logoUrl from '../assets/runtime/ui/game-logo.png?url';
import glovePointerUrl from '../assets/runtime/ui/leather-glove-pointer.png?url';

const symbolAssetModules = import.meta.glob<string>(
  '../assets/runtime/symbols/*.png',
  {
    eager: true,
    import: 'default',
    query: '?url',
  },
);

const SYMBOL_SCALE_MULTIPLIERS: Readonly<Record<string, number>> = {
  '09_Buffalo': 1.3,
};

const symbolAssets = Object.entries(symbolAssetModules)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([path, url]) => ({ id: getSymbolId(path), url }));

export interface PlayableSymbol {
  id: string;
  texture: Texture;
  scale: number;
}

export interface PlayableTextures {
  glovePointer: Texture;
  logo: Texture;
  symbols: PlayableSymbol[];
}

export async function loadPlayableTextures(): Promise<PlayableTextures> {
  await Assets.load([
    ...symbolAssets.map(({ url }) => url),
    logoUrl,
    glovePointerUrl,
  ]);

  return {
    glovePointer: Texture.from(glovePointerUrl),
    logo: Texture.from(logoUrl),
    symbols: symbolAssets.map(({ id, url }) => ({
      id,
      texture: Texture.from(url),
      scale: SYMBOL_SCALE_MULTIPLIERS[id] ?? 1,
    })),
  };
}

function getSymbolId(path: string): string {
  const fileName = path.split('/').pop();

  if (!fileName) {
    throw new Error(`Could not determine the symbol name from "${path}".`);
  }

  return fileName.replace(/\.png$/i, '');
}
