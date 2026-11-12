import * as Blockly from 'blockly';
import { FAST4WD_BOARD_ID, getBoardProfile, projectBoardId } from '../boards/profiles.js';
import { defaultRobotDevices } from '../boards/robot-devices.js';
import { TYPES, NEWMANIA_MODEL, previewMotorTypes, usesNewmaniaProgram } from '../blocks/newmania.js';
import { generateNewmania } from '../generators/newmania.js';

// Only called after the UI confirmation. Source object/workspace is never edited.
export function copyToNewmaniaProgram(source, id) {
  const copy=structuredClone(source),check=new Blockly.Workspace();
  const issues=[];
  const issue=(b,message)=>issues.push({id:b?.id??'workspace',type:b?.type??'workspace',warnings:[message]});
  try {
    Blockly.serialization.workspaces.load(copy.workspace,check);
    const blocks=check.getAllBlocks(false);
    if(!usesNewmaniaProgram(source)) {
      const starts=blocks.filter(b=>b.type==='beginner_start'),loops=blocks.filter(b=>b.type==='beginner_forever');
      for(const b of blocks.filter(b=>b.type==='robot_ps4_event'))issue(b,'Sự kiện độc lập không thể tự ghép vào một luồng mà bảo đảm cùng hành vi. Bản gốc giữ nguyên.');
      if(starts.length>1||loops.length>1)issue(null,'Có nhiều luồng khởi tạo/lặp độc lập; chưa thể tự quyết định thứ tự chuyển đổi.');
      if(issues.length)return {project:null,issues};
      const top=copy.workspace.blocks?.blocks??[];
      const root=top.find(b=>b.type==='beginner_start')??{type:TYPES.root,id:crypto.randomUUID(),x:40,y:40};
      const loop=top.find(b=>b.type==='beginner_forever');
      root.type=TYPES.root;root.deletable=false;
      root.inputs??={};
      if(loop) {
        loop.type=TYPES.forever;
        let tail=root.inputs.DO?.block;
        if(!tail)root.inputs.DO={block:loop};
        else {while(tail.next?.block)tail=tail.next.block;tail.next={block:loop};}
      }
      const map=state=>{
        if(!state||typeof state!=='object')return;
        if(previewMotorTypes.has(state.type))state.type=previewMotorTypes.get(state.type);
        if(state.type==='robot_ps4_button'){state.type=TYPES.button;state.fields={...state.fields,STATE:'HELD'};}
        for(const value of Object.values(state))if(value&&typeof value==='object')map(value);
      };
      map(copy.workspace);
      const usesPs4=blocks.some(b=>['robot_ps4_axis','robot_ps4_button','fast4wd_connected'].includes(b.type));
      if(usesPs4)root.inputs.DO={block:{type:TYPES.connect,id:crypto.randomUUID(),...(root.inputs.DO?.block?{next:{block:root.inputs.DO.block}}:{})}};
      copy.workspace.blocks??={languageVersion:0};
      copy.workspace.blocks.blocks=[root,...top.filter(b=>b!==root&&b!==loop)];
    }
    copy.boardId=FAST4WD_BOARD_ID;copy.programModel=NEWMANIA_MODEL;copy.editorMode='beginner';
    const devices=projectBoardId(source)===FAST4WD_BOARD_ID&&source.deviceConfigs?.[FAST4WD_BOARD_ID]
      ? structuredClone(source.deviceConfigs[FAST4WD_BOARD_ID]):defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID));
    copy.deviceConfigs={...copy.deviceConfigs,[FAST4WD_BOARD_ID]:devices};
    const converted=new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(copy.workspace,converted);
      const result=generateNewmania(converted,FAST4WD_BOARD_ID,devices);
      if(result.warnings.length) {
        // Keep a precise per-block report; never persist a partially converted copy.
        for(const b of converted.getAllBlocks(false)) {
          const matches=result.warnings.filter(w=>w.includes(b.id));
          for(const message of matches)issue(b,message);
        }
        if(!issues.length)issue(null,result.warnings.join('\n'));
        return {project:null,issues};
      }
      copy.workspace=Blockly.serialization.workspaces.save(converted);
    } finally {converted.dispose();}
    copy.id=id;copy.name=source.name+' (Newmania mới)';copy.updatedAt=new Date().toISOString();
    return {project:copy,issues:[]};
  } catch(error) {issue(null,error.message);return {project:null,issues};}
  finally {check.dispose();}
}
