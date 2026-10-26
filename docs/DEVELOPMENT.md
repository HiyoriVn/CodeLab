# Development setup

## Requirements

- Node.js compatible with Vite 7.
- npm.
- A modern desktop browser. The editor does not currently connect to hardware.

## Run the web app

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a static production bundle:

```bash
npm run build
npm run preview
```

These commands are defined by the Phase 1 scaffold. They have not yet been run in this environment; report any version-specific issues and update this guide after verifying the setup.

## Current editor behavior

- Blockly workspace with built-in control, logic, math, text, variable, and procedure categories.
- Workspace draft autosaved in the current browser's local storage.
- Workspace can be downloaded as a versioned JSON file and reopened in CodeLab.
- Imported files must use the CodeLab workspace format and a supported version.
- The initial Arduino C++ preview handles numeric values, basic logic/comparisons, arithmetic, conditional and loop blocks, simple variables with a single inferable type, text concatenation, and serial text output.
- Blocks without a generator are shown as placeholders with a warning. Variables assigned mixed or unknown types also warn and use placeholders; generated preview is incomplete when warnings appear.

This is a web-first editor scaffold. It has no compile/upload flow, native desktop shell, or ESP32-S3 hardware transport yet. Browser local storage is scoped to that browser profile; use the downloaded workspace file to move work between machines or browsers.

## Contributor workflow

1. Read `AGENTS.md`, `docs/ROADMAP.md`, and the relevant architecture/testing sections.
2. Select one small acceptance criterion from the current phase.
3. Create a topic branch and keep the change focused.
4. Run only checks that exist in the repository; record exact results.
5. Update docs when a decision, command, or verified capability changes.
6. Open a pull request with scope, verification, and hardware details where relevant.
