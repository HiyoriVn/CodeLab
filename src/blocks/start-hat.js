import * as Blockly from 'blockly';

export function lockCapHat(block) {
  Object.defineProperty(block, 'hat', {
    configurable: true,
    enumerable: true,
    get: () => 'cap',
    set: () => {},
  });
}

for (const type of ['beginner_start']) {
  const def = Blockly.Blocks[type];
  if (!def || typeof def.init !== 'function' || def.codelabCapHat) continue;
  const init = def.init;
  def.init = function codelabCapHatInit(...args) {
    const result = init.apply(this, args);
    lockCapHat(this);
    return result;
  };
  def.codelabCapHat = true;
}
