# Contributing

Thanks for helping build CodeLab. At this stage the repository contains planning documents only; application contributions should follow the roadmap and record decisions as they are made.

## Before opening a pull request

- Read `AGENTS.md` and the relevant roadmap and architecture sections.
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
