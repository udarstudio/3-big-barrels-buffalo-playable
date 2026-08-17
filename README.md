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

Gameplay, assets, audio, MRAID behavior, and creative sequencing are intentionally not included in this initial foundation.
