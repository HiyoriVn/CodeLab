import * as Blockly from 'blockly';

import { blockStyles, categoryStyles } from './palette.js';

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
