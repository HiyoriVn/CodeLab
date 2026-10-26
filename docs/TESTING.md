# Testing and verification strategy

No application or test suite is present in the repository at planning time. This document defines checks to introduce with the corresponding implementation; it does not report that they have run.

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
