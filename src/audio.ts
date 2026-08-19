import bisonCallUrl from '../assets/runtime/audio/bison-call-temp.ogg?url';
import reelSpinUrl from '../assets/runtime/audio/reel-spin-temp.mp3?url';
import wolfHowlUrl from '../assets/runtime/audio/wolf-howl-temp.mp3?url';

export interface PlayableAudio {
  playReelSpin: () => void;
  stopReelSpin: () => void;
  playWolfWin: () => void;
  playBuffaloWin: () => void;
}

export function createPlayableAudio(): PlayableAudio {
  const reelSpin = createAudio(reelSpinUrl, 0.5);
  const wolfHowl = createAudio(wolfHowlUrl, 0.75);
  const bisonCall = createAudio(bisonCallUrl, 0.85);

  const stopAnimalSounds = (): void => {
    stop(wolfHowl);
    stop(bisonCall);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop(reelSpin);
      stopAnimalSounds();
    }
  });

  return {
    playReelSpin: () => {
      stopAnimalSounds();
      play(reelSpin);
    },
    stopReelSpin: () => stop(reelSpin),
    playWolfWin: () => {
      stopAnimalSounds();
      play(wolfHowl);
    },
    playBuffaloWin: () => {
      stopAnimalSounds();
      play(bisonCall);
    },
  };
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
