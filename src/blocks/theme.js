import * as Blockly from 'blockly';

const mix = (hex, other, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.substr(i, 2), 16) * (1 - t) + parseInt(other.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('')}`;
const style = (primary, extra = {}) => ({
  colourPrimary: primary,
  colourSecondary: mix(primary, '#FFFFFF', 0.9),
  colourTertiary: mix(primary, '#000000', 0.34),
  ...extra,
});

export const blockStyles = {
  logic_blocks: style('#8DB5E6'),
  loop_blocks: style('#7ECBB1'),
  math_blocks: style('#9ECB8E'),
  text_blocks: style('#EBC96F'),
  list_blocks: style('#C4A3D8'),
  colour_blocks: style('#D9A0D3'),
  variable_blocks: style('#EDB070'),
  variable_dynamic_blocks: style('#EDB070'),
  procedure_blocks: style('#EE9BB0', { hat: 'cap' }),
};

const categoryStyles = {
  loop_category: { colour: '#80e0c0' },
  logic_category: { colour: '#90caf9' },
  math_category: { colour: '#a5d6a7' },
  text_category: { colour: '#ffe082' },
  variable_category: { colour: '#ffcc80' },
  procedure_category: { colour: '#f8a5b8' },
};

const palettes = {
  light: { pan: '#eef0f7', fly: '#d3e0f7', ink: '#1f2340', scroll: '#b8bdd4', cursor: '#1f2340' },
  dark: { pan: '#1e2236', fly: '#2d3558', ink: '#e8eaf6', scroll: '#3a3f5c', cursor: '#e8eaf6' },
};

const makeTheme = (name, mode) => Blockly.Theme.defineTheme(name, {
  base: Blockly.Themes.Classic,
  blockStyles,
  categoryStyles,
  componentStyles: {
    workspaceBackgroundColour: 'transparent',
    toolboxBackgroundColour: palettes[mode].pan,
    toolboxForegroundColour: palettes[mode].ink,
    flyoutBackgroundColour: palettes[mode].fly,
    flyoutForegroundColour: palettes[mode].ink,
    flyoutOpacity: 1,
    scrollbarColour: palettes[mode].scroll,
    insertionMarkerColour: '#1976d2',
    insertionMarkerOpacity: 0.3,
    scrollbarOpacity: 0.6,
    cursorColour: palettes[mode].cursor,
  },
});

export const themes = { light: makeTheme('codelabLight', 'light'), dark: makeTheme('codelabDark', 'dark') };
