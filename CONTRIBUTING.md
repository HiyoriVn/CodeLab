# Contributing

Thanks for helping build CodeLab. The repository contains a React/Vite/Blockly application, Arduino generator, local build bridge and planning documents. Dedicated mainboard and PS4 bridge firmware are not implemented. Follow the relevant roadmap and record decisions and actual verification results.

## Before opening a pull request

- Read `AGENTS.md` and the relevant roadmap and architecture sections.
- Use `docs/IMPLEMENTATION_PLAN.md` for hardware/firmware Phase 01-07; `docs/ROADMAP.md` is the separate historical web roadmap. The current Phase 01 request permits documentation/audit only, not application fixes, firmware implementation, commit or push.
- Keep the PR focused on one phase outcome or closely related documentation.
- For code changes, run the checks defined by the actual project scaffold and include their results.
- For generated-code changes, include or update deterministic fixtures.
- For hardware changes, include the tested board/module, wiring, toolchain, and outcome.
- Update documentation when supported behavior or setup instructions change.

## Pull request description

Include:
- What changed and which roadmap criterion it advances.
- How it was verified, including commands and results.
- Hardware and toolchain details for device work.
- Known limitations or follow-up decisions.

## Scope and safety

- Arduino C++ is the MVP output. MicroPython is out of scope unless the product owner updates the decision.
- Do not claim hardware support without a corresponding verification record.
- Device upload must be an explicit user action with a visible target.
- Do not add credentials, private keys, firmware blobs, or personal device data.
