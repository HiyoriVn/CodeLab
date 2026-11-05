import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/controller.js';
export function ps4Workspace() {
 const w=new Blockly.Workspace();let id=0;const block=type=>w.newBlock(type,'ps4-'+id++);
 const uart=block('codelab_ps4_begin_uart');
 for(const [name,value] of Object.entries({RX:7,TX:6,BAUD:115200})) {const n=block('math_number');n.setFieldValue(value,'NUM');uart.getInput(name).connection.connect(n.outputConnection);}
 let tail=uart;
 for(const type of ['codelab_ps4_connected','codelab_ps4_axis','codelab_ps4_button']) {const print=block('text_print');print.getInput('TEXT').connection.connect(block(type).outputConnection);tail.nextConnection.connect(print.previousConnection);tail=print;}
 return w;
}
