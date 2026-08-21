export const DEFAULT_DESTINATION_URL =
  'https://slotslaunch.com/koala-games/3-big-barrels-buffalo';

interface MraidApi {
  addEventListener?: (event: 'ready', listener: () => void) => void;
  getState?: () => string;
  open?: (url: string) => void;
}

type PlayableWindow = Window & {
  clickTag?: string;
  mraid?: MraidApi;
};

export function runWhenMraidReady(start: () => void): void {
  const mraid = getPlayableWindow().mraid;
  let hasStarted = false;

  const startOnce = (): void => {
    if (hasStarted) {
      return;
    }

    hasStarted = true;
    start();
  };

  if (!mraid?.getState || !mraid.addEventListener) {
    startOnce();
    return;
  }

  try {
    if (mraid.getState() === 'loading') {
      mraid.addEventListener('ready', startOnce);
      return;
    }
  } catch (error) {
    console.warn('MRAID state could not be read; starting normally.', error);
  }

  startOnce();
}

export function openClickThrough(): void {
  const playableWindow = getPlayableWindow();
  const destination = playableWindow.clickTag?.trim()
    || DEFAULT_DESTINATION_URL;

  window.dispatchEvent(new CustomEvent('playable:cta'));

  if (playableWindow.mraid?.open) {
    playableWindow.mraid.open(destination);
    return;
  }

  window.open(destination, '_blank', 'noopener');
}

function getPlayableWindow(): PlayableWindow {
  return window as PlayableWindow;
}
