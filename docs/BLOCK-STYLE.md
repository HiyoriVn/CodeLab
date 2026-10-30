# Block style

Block look follows the `demo_ui` block (rounded notch, offset shadow layer, white input pill) but with smaller corners and softer colours so it reads less childish. It is defined in three places:

- `src/blocks/renderer.js` — custom renderer `codelab`, derived from Blockly's `zelos`. Corner radius 14 (demo: 26), block height 44 (demo: 52), rounded notch 40 × 9 that bulges UP at the top of a block and is cut into the bottom of the block above (custom `makeNotch`); a block with nothing attached below gets a flat bottom (`shapeFor` returns `FLAT_TAIL`), one with a block below gets the cut-in, Be Vietnam Pro 11 pt weight 600, value slots as rounded rectangles, `▾` text arrow on dropdowns. Falls back to `zelos` if registration or `inject` fails.
- `src/blocks/theme.js` — muted pastel palette (`colourPrimary` fill, `colourSecondary` near-white input, `colourTertiary` outline/empty slot) for light and dark themes.
- `src/styles.css` (end of file) — offset shadow `drop-shadow(3px 4px 0 …)` only on the last block of a stack (class `has-next` is set in `BlocklyWorkspace.jsx`; nested value blocks get none, class `is-nested`), hover lift in the block picker, dark ink text (#1F2340) on blocks. Sidebar category colours are unchanged.

## Block types

| # | Type | Blockly shape | Examples |
|---|------|---------------|----------|
| 1 | Statement | notch bulges up at top; bottom flat (last) or cut-in (has block below) | `codelab_gpio_write`, `text_print` |
| 2 | Wrapper (C) | statement input | `controls_repeat_ext`, `controls_whileUntil` |
| 3 | Value | squared output | `math_number`, `math_arithmetic`, `codelab_analog_read` |
| 4 | Condition | hexagonal output (Boolean) | `logic_compare`, `codelab_ps4_connected` |
| 5 | If | wrapper with a condition slot | `controls_if` |
| 6 | Hat | `hat: 'cap'` in the style | `procedures_defnoreturn` |
| 7 | Cap | no next connection | `controls_flow_statements` |

`docs/block-preview.html` is a plain SVG drawing of these types with the same dimensions and colours. It is a design reference, not Blockly output.

## Status

Not run in a browser or built in this environment (Blockly could not be installed). Run `npm install && npm run dev` and check: that the bottom switches between flat and cut-in when a block is attached/detached, notch shape and snapping, number slots, C-blocks, procedure hat, offset shadow on stacks, dark theme. If the `codelab` renderer throws during `inject`, the app logs a warning and uses `zelos`.
