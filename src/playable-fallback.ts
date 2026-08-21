import logoUrl from '../assets/runtime/ui/game-logo.png?url';
import { openClickThrough } from './ad-environment';

export function showPlayableFallback(host: HTMLElement, reason: unknown): void {
  console.error('The playable renderer is unavailable.', reason);

  const fallback = document.createElement('section');
  const logo = document.createElement('img');
  const button = document.createElement('button');

  fallback.className = 'playable-fallback';
  fallback.setAttribute('aria-label', '3 Big Barrels Buffalo download screen');

  logo.className = 'playable-fallback__logo';
  logo.src = logoUrl;
  logo.alt = '3 Big Barrels Buffalo';

  button.className = 'playable-fallback__button';
  button.type = 'button';
  button.textContent = 'PLAY NOW';
  button.addEventListener('click', openClickThrough);

  fallback.append(logo, button);
  host.replaceChildren(fallback);
}
