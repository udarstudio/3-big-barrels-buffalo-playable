import bisonCallUrl from '../assets/runtime/audio/bison-call-temp.ogg?url';
import backgroundMusicUrl from '../assets/runtime/audio/dusty-jackpot-spin.m4a?url';
import jackpotCoinRainUrl from '../assets/runtime/audio/jackpot-coin-rain.mp3?url';
import reelSpinUrl from '../assets/runtime/audio/reel-spin-loop.mp3?url';
import reelStopUrl from '../assets/runtime/audio/reel-stop-accent.mp3?url';
import wolfHowlUrl from '../assets/runtime/audio/wolf-howl-realistic.mp3?url';

export interface PlayableAudio {
  startMusic: () => void;
  playReelSpin: () => void;
  setReelSpinRate: (playbackRate: number) => void;
  stopReelSpin: () => void;
  playReelStop: (playbackRate: number) => void;
  playWolfWin: () => void;
  playBuffaloWin: () => void;
  playCoinRain: () => void;
  setCoinRainVolume: (volume: number) => void;
  stopCoinRain: () => void;
}

const COIN_RAIN_VOLUME = 0.65;

export function createPlayableAudio(): PlayableAudio {
  const backgroundMusic = createAudio(backgroundMusicUrl, 0.4);
  const reelSpin = createAudio(reelSpinUrl, 0.4);
  reelSpin.loop = true;
  reelSpin.preservesPitch = false;
  const reelStop = createAudio(reelStopUrl, 0.5);
  reelStop.preservesPitch = false;
  const wolfHowl = createAudio(wolfHowlUrl, 0.75);
  const bisonCall = createAudio(bisonCallUrl, 0.85);
  const coinRain = createAudio(jackpotCoinRainUrl, COIN_RAIN_VOLUME);

  const stopAnimalSounds = (): void => {
    stop(wolfHowl);
    stop(bisonCall);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop(backgroundMusic);
      stop(reelSpin);
      stop(reelStop);
      stopAnimalSounds();
      stop(coinRain);
    }
  });

  return {
    startMusic: () => playIfPaused(backgroundMusic),
    playReelSpin: () => {
      stopAnimalSounds();
      reelSpin.playbackRate = 1;
      play(reelSpin);
    },
    setReelSpinRate: (playbackRate) => {
      reelSpin.playbackRate = playbackRate;
    },
    stopReelSpin: () => stop(reelSpin),
    playReelStop: (playbackRate) => {
      reelStop.playbackRate = playbackRate;
      play(reelStop);
    },
    playWolfWin: () => {
      stopAnimalSounds();
      play(wolfHowl);
    },
    playBuffaloWin: () => {
      stopAnimalSounds();
      play(bisonCall);
    },
    playCoinRain: () => {
      coinRain.volume = COIN_RAIN_VOLUME;
      play(coinRain);
    },
    setCoinRainVolume: (volume) => {
      coinRain.volume = COIN_RAIN_VOLUME * Math.min(Math.max(volume, 0), 1);
    },
    stopCoinRain: () => stop(coinRain),
  };
}

function playIfPaused(audio: HTMLAudioElement): void {
  if (!audio.paused) {
    return;
  }

  void audio.play().catch(() => {
    // Some preview environments block sound until the first user gesture.
  });
}

function createAudio(url: string, volume: number): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.volume = volume;
  return audio;
}

function play(audio: HTMLAudioElement): void {
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Some preview environments block sound until the first user gesture.
  });
}

function stop(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
}
