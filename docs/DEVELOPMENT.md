# Development setup

## Current state

The repository is documentation-only at this planning stage. There is no application scaffold or package manifest yet, so application commands below are intentionally not listed as working commands. Phase 1 of `docs/ROADMAP.md` will add the scaffold and replace this section with verified setup instructions.

## Planned setup checklist

Before the first application contribution, the project must choose and document:

- Supported operating systems and runtime/tool versions.
- Application framework and package manager.
- Arduino toolchain installation and version pinning.
- ESP32-S3 board package and upload prerequisites.
- How to run the editor, linting, tests, and production build.
- Optional hardware setup and permissions for USB/serial access.

## Contributor workflow

1. Read `AGENTS.md`, `docs/ROADMAP.md`, and the relevant architecture/testing sections.
2. Select one small acceptance criterion from the current phase.
3. Create a topic branch and keep the change focused.
4. Run only checks that exist in the repository; record exact results.
5. Update docs when a decision, command, or verified capability changes.
6. Open a pull request with scope, verification, and hardware details where relevant.

Do not install toolchains or run imagined npm commands against this documentation-only repository.
