# @paperclipai/gg-ui

Published static assets for the Paperclip board UI.

## What gets published

The npm package contains the production build under `dist/`. It does not ship the UI source tree or workspace-only dependencies.

## Storybook

Storybook config, stories, and fixtures live under `gg-ui/storybook/`.

```sh
pnpm --filter @paperclipai/gg-ui storybook
pnpm --filter @paperclipai/gg-ui build-storybook
```

## Typical use

Install the package, then serve or copy the built files from `node_modules/@paperclipai/gg-ui/dist`.
