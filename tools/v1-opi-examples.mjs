import * as Blockly from 'blockly';
import { mkdir, writeFile } from 'node:fs/promises';
import { exampleWorkspace } from './v1-examples.mjs';
import { generateArduino } from '../src/generators/arduino.js';

export const OPI_BOARD_ID = 'newmania-v1-16m-opi-experimental';
export async function writeOpiExamples() {
  for (const name of ['minimal', 'blink', 'serial_hello', 'pwm_led']) {
    const workspace = exampleWorkspace(name);
    try {
      const result = generateArduino(workspace, OPI_BOARD_ID);
      if (result.warnings.length) throw new Error(result.warnings.join('\n'));
      const dir = `firmware/verification/v1_opi_examples/${name}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/${name}.ino`, result.code);
      await writeFile(`${dir}/${name}.codelab.json`, JSON.stringify({
        format: 'codelab-project', version: 1,
        project: { name: `Experimental OPI ${name}`, boardId: OPI_BOARD_ID,
          workspace: Blockly.serialization.workspaces.save(workspace) },
      }, null, 2) + '\n');
    } finally { workspace.dispose(); }
  }
}
if (process.argv[1]?.endsWith('v1-opi-examples.mjs')) await writeOpiExamples();
