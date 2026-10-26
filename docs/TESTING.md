# Testing and verification strategy

The Phase 1 web scaffold and initial Phase 2 generator are present but have not yet been run or verified. There is no automated test suite at this stage. This document defines checks to add with implementation and manual scenarios to record; it does not report successful results.

## Phase 1 manual acceptance

When the scaffold is available locally, verify and record:
- The app starts in a supported desktop browser and the Blockly toolbox renders.
- Blocks can be created, connected, moved, deleted, and undone/redone.
- The example workspace loads and can be edited.
- Changes survive a page refresh in the same browser profile.
- Downloaded workspace files reopen with their blocks intact.
- Invalid JSON, unknown format, and unsupported schema versions show a clear error without replacing the current workspace.
- The editor remains usable at a narrow/mobile viewport.

## Phase 2 manual acceptance

When the app can be run locally, verify and record:
- The sample workspace produces the expected `setup()` and `loop()` Arduino structure.
- Each supported block generates syntactically plausible C++ with nested statements preserved.
- Supported control, math, text, and variable blocks produce the documented output.
- Unsupported blocks and mixed/unknown variable types are listed and visibly marked as placeholders.
- Repeated generation from an unchanged workspace produces identical output.
- Copying the preview works where the browser grants clipboard access.

## Verification layers

### Workspace and block model
- Serialize and restore representative workspaces.
- Validate type checks, required inputs, pin constraints, and workspace schema migration.
- Verify unsupported block types are reported rather than dropped.

### Generator
- Golden fixtures for each supported block and representative combinations.
- Determinism checks for identical workspace and target inputs.
- Compile generated examples with the pinned Arduino toolchain and ESP32-S3 target.
- Confirm diagnostics identify the relevant block or generated source location.

### Device workflow
- Unit/integration coverage for port selection, cancellation, disconnect, timeout, and failed upload.
- Confirm upload requires an explicit user action and target selection.
- Hardware smoke test on each supported board and host OS.

### PS4 receiver
- Test protocol parsing with captured/synthetic valid, partial, malformed, and out-of-range frames.
- Verify connection loss and neutral controller state behavior.
- Hardware test against the exact module, wiring, voltage, interface, and firmware documented for the release.

### User experience
- Keyboard navigation and basic accessibility checks.
- Manual beginner scenarios using the published examples.
- Larger-workspace responsiveness and repeated compile/upload cycles before release.

## Hardware test record

For every hardware-dependent result, record:
- Date and CodeLab commit.
- Board model and revision.
- Receiver/peripheral model and firmware, when applicable.
- Wiring, voltage, transport settings, and relevant pin mapping.
- Host OS, toolchain version, and result.
- Any limitation or reproducible failure.

## Release gate

A first release requires generator fixtures, successful compilation for the supported ESP32-S3 target, successful upload smoke tests for the supported board matrix, validated PS4 integration if included in the release scope, and documented known limitations. Do not label untested hardware combinations as supported.
