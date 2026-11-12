import { mkdirSync,writeFileSync } from 'node:fs';
import * as Blockly from 'blockly';
import { LESSONS,lessonProject } from '../src/lessons/newmania.js';
import { generateArduino } from '../src/generators/arduino.js';
for(const lesson of LESSONS){
  const project=lessonProject(lesson.id),workspace=new Blockly.Workspace();
  try{
    Blockly.serialization.workspaces.load(project.workspace,workspace);
    const output=generateArduino(workspace,project.boardId,project.deviceConfigs[project.boardId]);
    if(output.warnings.length)throw Error(output.warnings.join('\n'));
    const directory=`examples/newmania/lessons/${lesson.id}`;mkdirSync(directory,{recursive:true});
    writeFileSync(`${directory}/${lesson.id}.codelab.json`,JSON.stringify({format:'codelab-project',version:1,project},null,2)+'\n');
    writeFileSync(`${directory}/${lesson.id}.ino`,output.code);
    console.log(lesson.label,output.code.length);
  }finally{workspace.dispose();}
}
