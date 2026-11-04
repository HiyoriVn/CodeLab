# UI block templates

Preserved from Bách's `docs/ui_ux_block` commit `54ef650`.

These modules export reference definitions but are not imported or registered by the application. Runtime blocks are still registered in `../robotics.js` and `../controller.js`, and the toolbox is defined in `../../components/BlocklyWorkspace.jsx`.

Before activating a template, compare its type, input names, fields, serialization, and generator support against the existing runtime definition. Do not register a second definition for an existing type or load `block_effects.css` globally without UI verification. This directory does not add verified hardware support.
