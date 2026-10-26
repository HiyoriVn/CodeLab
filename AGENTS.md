# Instructions for coding agents

## Source of truth

- Read this file and the relevant documents in `docs/` before changing architecture or project scope.
- The repository began empty. Treat all product functionality as planned until implementation and verification land here.
- Keep claims about the NewmaniaCodeLab archive clearly attributed to that separate reference project.
- Keep the MVP on ESP32-S3 and Arduino C++. Do not add MicroPython generation or conversion to MVP scope unless the project owner changes this decision.
- The PS4 controller connects through an external receiver module over UART or I2C. Do not assume a specific module, pinout, voltage, packet format, or library. Record confirmed hardware details in the architecture and hardware documentation before coding against them.

## Implementation guidance

- Prefer small, reviewable changes that complete one roadmap acceptance criterion.
- Keep block definitions, language generation, board configuration, device transport, and UI concerns separated.
- Treat generated code as a user-visible artifact: deterministic output, readable formatting, stable helper definitions, and useful source mapping where practical.
- Keep hardware access behind an interface so block logic and most tests can run without a connected board.
- Never silently upload or execute generated code. Show the target and require an explicit user action.
- Validate pin ranges and board capabilities before generating or uploading code. Avoid hard-coding example pin assignments as universal defaults.
- Do not add dependencies without explaining the need in the change.
- Preserve user workspace data when formats evolve; version serialized workspaces and document migrations.

## Verification

- Follow `docs/TESTING.md` and the repository's actual scripts once they exist.
- Do not claim a check passed unless it was run and its result is available.
- Hardware-dependent acceptance requires recording the board, firmware/toolchain version, wiring, and observed result.
- If the repository lacks a runnable application or required hardware, state that limitation instead of inventing a successful result.

## Documentation

- Update README, architecture, roadmap, setup, or testing documents when behavior or project decisions change.
- Label features as implemented only after they exist in this repository and have been verified.
- Use `CONTRIBUTING.md` for the pull request workflow and documentation expectations.
