# 3 Big Barrels Buffalo Playable

Clean technical foundation for the Medialicious playable-ad assignment.

## Commands

```sh
npm run dev
npm run typecheck
npm run build
npm run preview
```

The production build is emitted as a self-contained `dist/index.html` file. The AppLovin-specific filename and MRAID lifecycle will be introduced in the next implementation step.

## Current scope

- PixiJS rendering
- TypeScript strict mode
- Vite development server
- Responsive portrait/landscape canvas
- Single-file production bundling
- Runtime copies of all 19 supplied symbols
- Randomized 5×3 reel prototype
- Ticker-driven reel spin with acceleration and deceleration
- Staggered left-to-right reel stops with landing bounce

Win logic, audio, MRAID behavior, and creative sequencing are intentionally not included yet.
