# NewmaniaCodeLab reference baseline

This note separates the supplied archive from the CodeLab destination repository. The archive is a design/implementation reference only; it is not copied into this repository by the planning change.

## Observed in the archive

The archive README labels these features as worked: Blockly workspace, block-to-code generation, Web Serial connection, serial monitor, system notifications, compatibility checking, board reboot, and workspace save/load as a file. Its planned list includes board variants and block banks; future items include accounts and workspace sharing; optional items include themes and multiple languages.

Inspection of the archive also found a React/Vite + Tauri application, Blockly 12 dependencies, Python generator imports, and a custom Python library. Its README reports browser compatibility for Chrome, Edge, Cốc Cốc, and OperaGX, and lack of Firefox compatibility. Those browser claims were not independently tested during this planning task.

## Implications for CodeLab

- Reuse interaction ideas and relevant workspace patterns only after evaluating their fit.
- Replace the Python/MicroPython generator with Arduino C++ for the CodeLab MVP.
- Reassess device communication: Web Serial and Tauri behavior are not automatically suitable for every intended host platform.
- Revalidate all claimed reference features before describing them as CodeLab features.
- Keep the external PS4 receiver's actual interface and protocol explicit; the archive does not establish those details.

## Verification status

The NewmaniaCodeLab archive was available and selectively inspected. Its README and source code are evidence about that archive only. The GitHub CodeLab repository was empty before its initialization commit, so no CodeLab application functionality was verified.
