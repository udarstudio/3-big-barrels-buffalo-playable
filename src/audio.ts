import bisonCallUrl from '../assets/runtime/audio/bison-call-temp.m4a?url';
import backgroundMusicUrl from '../assets/runtime/audio/dusty-jackpot-spin.m4a?url';
import bigWinBellUrl from '../assets/runtime/audio/big-win-bell.m4a?url';
import buttonClickUrl from '../assets/runtime/audio/button-click.m4a?url';
import jackpotCoinRainUrl from '../assets/runtime/audio/jackpot-coin-rain.m4a?url';
import reelSpinUrl from '../assets/runtime/audio/reel-spin-loop.m4a?url';
import reelStopUrl from '../assets/runtime/audio/reel-stop-accent.m4a?url';
import wolfHowlUrl from '../assets/runtime/audio/wolf-howl-realistic.m4a?url';

const COIN_RAIN_VOLUME = 0.65;
const EFFECT_URLS = [
  buttonClickUrl,
  reelSpinUrl,
  reelStopUrl,
  wolfHowlUrl,
  bisonCallUrl,
  bigWinBellUrl,
  jackpotCoinRainUrl,
] as const;

interface ActiveSound {
  gain: GainNode;
  source: AudioBufferSourceNode;
}

interface EffectPlayer {
  play: (
    url: string,
    options: { loop?: boolean; playbackRate?: number; volume: number },
  ) => Promise<ActiveSound | undefined>;
  routeMediaElement: (audio: HTMLMediaElement) => void;
  unlock: () => void;
}

interface ManagedSound {
  play: (playbackRate?: number) => void;
  setPlaybackRate: (playbackRate: number) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
}

export interface PlayableAudio {
  startMusic: () => void;
  playButtonClick: () => void;
  playReelSpin: () => void;
  setReelSpinRate: (playbackRate: number) => void;
  stopReelSpin: () => void;
  playReelStop: (playbackRate: number) => void;
  playWolfWin: () => void;
  playBuffaloWin: () => void;
  playBigWinBell: () => void;
  playCoinRain: () => void;
  setCoinRainVolume: (volume: number) => void;
  stopCoinRain: () => void;
}

export function createPlayableAudio(): PlayableAudio {
  const effects = createEffectPlayer();
  const backgroundMusic = createAudio(backgroundMusicUrl, 0.4);
  effects.routeMediaElement(backgroundMusic);
  const reelSpin = createManagedSound(effects, reelSpinUrl, 0.4, true);
  const reelStop = createManagedSound(effects, reelStopUrl, 0.5);
  const wolfHowl = createManagedSound(effects, wolfHowlUrl, 0.75);
  const bisonCall = createManagedSound(effects, bisonCallUrl, 0.85);
  const bigWinBell = createManagedSound(effects, bigWinBellUrl, 1);
  const coinRain = createManagedSound(
    effects,
    jackpotCoinRainUrl,
    COIN_RAIN_VOLUME,
  );

  const stopAnimalSounds = (): void => {
    wolfHowl.stop();
    bisonCall.stop();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop(backgroundMusic);
      reelSpin.stop();
      reelStop.stop();
      stopAnimalSounds();
      bigWinBell.stop();
      coinRain.stop();
    }
  });

  return {
    startMusic: () => {
      effects.unlock();
      playIfPaused(backgroundMusic);
    },
    playButtonClick: () => {
      effects.unlock();
      void effects.play(buttonClickUrl, { volume: 0.65 });
    },
    playReelSpin: () => {
      stopAnimalSounds();
      reelSpin.play(1);
    },
    setReelSpinRate: reelSpin.setPlaybackRate,
    stopReelSpin: reelSpin.stop,
    playReelStop: reelStop.play,
    playWolfWin: () => {
      stopAnimalSounds();
      wolfHowl.play();
    },
    playBuffaloWin: () => {
      stopAnimalSounds();
      bisonCall.play();
    },
    playBigWinBell: bigWinBell.play,
    playCoinRain: () => {
      coinRain.setVolume(COIN_RAIN_VOLUME);
      coinRain.play();
    },
    setCoinRainVolume: (volume) => {
      coinRain.setVolume(
        COIN_RAIN_VOLUME * Math.min(Math.max(volume, 0), 1),
      );
    },
    stopCoinRain: coinRain.stop,
  };
}

function createEffectPlayer(): EffectPlayer {
  const audioWindow = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    return {
      play: async () => undefined,
      routeMediaElement: () => undefined,
      unlock: () => undefined,
    };
  }

  const context = new AudioContextConstructor({ latencyHint: 'interactive' });
  const buffers = new Map<string, Promise<AudioBuffer>>();
  let hasUnlocked = false;

  const loadBuffer = (url: string): Promise<AudioBuffer> => {
    const existing = buffers.get(url);

    if (existing) {
      return existing;
    }

    const loading = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Audio request failed with ${response.status}.`);
        }

        return response.arrayBuffer();
      })
      .then((encodedAudio) => context.decodeAudioData(encodedAudio));

    buffers.set(url, loading);
    void loading.catch(() => undefined);
    return loading;
  };

  EFFECT_URLS.forEach((url) => loadBuffer(url));

  return {
    play: async (url, { loop = false, playbackRate = 1, volume }) => {
      const resume = context.state === 'suspended'
        ? context.resume()
        : Promise.resolve();

      try {
        const [buffer] = await Promise.all([loadBuffer(url), resume]);
        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = buffer;
        source.loop = loop;
        source.playbackRate.value = playbackRate;
        gain.gain.value = volume;
        source.connect(gain).connect(context.destination);
        source.addEventListener('ended', () => {
          source.disconnect();
          gain.disconnect();
        }, { once: true });
        source.start();
        return { gain, source };
      } catch (error) {
        console.warn('A playable sound effect could not start.', error);
        return undefined;
      }
    },
    routeMediaElement: (audio) => {
      const source = context.createMediaElementSource(audio);
      source.connect(context.destination);
    },
    unlock: () => {
      if (hasUnlocked && context.state === 'running') {
        return;
      }

      hasUnlocked = true;
      void context.resume().catch(() => undefined);

      // iOS requires a source to start synchronously inside the tap handler.
      const unlockSource = context.createBufferSource();
      unlockSource.buffer = context.createBuffer(1, 1, context.sampleRate);
      unlockSource.connect(context.destination);
      unlockSource.addEventListener('ended', () => unlockSource.disconnect(), {
        once: true,
      });
      unlockSource.start(0);
    },
  };
}

function createManagedSound(
  player: EffectPlayer,
  url: string,
  initialVolume: number,
  loop = false,
): ManagedSound {
  let active: ActiveSound | undefined;
  let generation = 0;
  let playbackRate = 1;
  let volume = initialVolume;

  const stopActive = (): void => {
    if (!active) {
      return;
    }

    stopActiveSound(active);
    active = undefined;
  };

  return {
    play: (nextPlaybackRate = playbackRate) => {
      playbackRate = nextPlaybackRate;
      const currentGeneration = ++generation;
      stopActive();

      void player.play(url, { loop, playbackRate, volume }).then((sound) => {
        if (!sound) {
          return;
        }

        if (generation !== currentGeneration) {
          stopActiveSound(sound);
          return;
        }

        active = sound;
      });
    },
    setPlaybackRate: (nextPlaybackRate) => {
      playbackRate = nextPlaybackRate;

      if (active) {
        active.source.playbackRate.value = playbackRate;
      }
    },
    setVolume: (nextVolume) => {
      volume = nextVolume;

      if (active) {
        active.gain.gain.value = volume;
      }
    },
    stop: () => {
      generation += 1;
      stopActive();
    },
  };
}

function stopActiveSound(sound: ActiveSound): void {
  try {
    sound.source.stop();
  } catch {
    // The source may already have ended naturally.
  }
}

function playIfPaused(audio: HTMLAudioElement): void {
  if (!audio.paused) {
    return;
  }

  void audio.play().catch(() => {
    // Preview environments can block music until the first user gesture.
  });
}

function createAudio(url: string, volume: number): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.volume = volume;
  audio.load();
  return audio;
}

function stop(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
}
