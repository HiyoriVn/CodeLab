import * as Blockly from 'blockly';
import { BLOCK_CATEGORY, styleNameOf } from './palette.js';

for (const [key, types] of Object.entries(BLOCK_CATEGORY)) {
  const style = styleNameOf(key);
  for (const type of types) {
    const def = Blockly.Blocks[type];
    if (!def || typeof def.init !== 'function' || def.codelabStyled) continue;
    const init = def.init;
    def.init = function codelabStyledInit(...args) {
      const result = init.apply(this, args);
      this.setStyle(style);
      return result;
    };
    def.codelabStyled = true;
  }
}

const adoptParentStyle = (block) => {
  if (!block.isShadow?.()) return;
  const parent = block.getParent?.();
  const style = parent?.getStyleName?.();
  if (style && style !== block.getStyleName?.()) block.setStyle(style);
};
const proto = Blockly.BlockSvg.prototype;
if (!proto.codelabAdopt) {
  const setParent = proto.setParent;
  proto.setParent = function codelabSetParent(parent) {
    const result = setParent.call(this, parent);
    if (parent) adoptParentStyle(this);
    return result;
  };
  const setShadow = proto.setShadow;
  proto.setShadow = function codelabSetShadow(...args) {
    const result = setShadow.apply(this, args);
    adoptParentStyle(this);
    return result;
  };
  proto.codelabAdopt = true;
}
