import * as Blockly from 'blockly';
import * as Vietnamese from 'blockly/msg/vi';
import { TYPES, workspaceOptions, designToolbox, initializeDesign, designDiagnostics, saveDesign, loadDesign, exampleDesign } from './model.js';
import { RENDERER } from '../blocks/renderer.js';
import { themes } from '../blocks/theme.js';
import './preview.css';

Blockly.setLocale(Vietnamese);
const host=document.getElementById('design-preview');
host.innerHTML=`<header><strong>Newmania ESP32S3 Board — Thử nghiệm Blockly</strong><p>Chỉ kiểm tra kéo thả và lưu/mở. Chưa thực thi, sinh C++, kết nối hoặc nạp board.</p><label>Ví dụ <select id="example"><option value="">Dự án mới</option><option value="hold">Giữ X chạy M1</option><option value="count">Nhấn X tăng biến</option><option value="drive">Joystick điều khiển mecanum</option></select></label> <button id="save" type="button">Lưu bản thử nghiệm</button> <label>Mở bản thử nghiệm <input type="file" id="open" accept=".json"></label></header><div id="workspace"></div><aside id="diagnostics" role="status" aria-live="polite"></aside><dialog id="replace-dialog"><form method="dialog"><p id="replace-message"></p><button value="cancel" autofocus>Hủy</button> <button value="replace">Thay nội dung thử nghiệm</button></form></dialog>`;
const w=Blockly.inject(host.querySelector('#workspace'),{...workspaceOptions,toolbox:designToolbox(),renderer:RENDERER,theme:themes.light,sounds:false,trashcan:true,move:{scrollbars:true,drag:true,wheel:true},zoom:{controls:true,wheel:true},grid:{spacing:24,length:2,colour:'#bec6d6',snap:true}});
const storageKey='codelab.blockly-design.stage1.v1';
let importing=false;
let storageError='';
let selectedExample='';
async function confirmReplacement(message) {
  const dialog=host.querySelector('#replace-dialog');
  host.querySelector('#replace-message').textContent=message;
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>resolve(dialog.returnValue==='replace'),{once:true});
    dialog.returnValue='cancel';dialog.showModal();
  });
}
function showError(message) {
  const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=message;
  host.querySelector('#diagnostics').prepend(p);
}
function replace(payload) {
  const check=loadDesign(payload);check.dispose();
  importing=true;
  try {
    w.clear();Blockly.serialization.workspaces.load(payload.workspace,w);w.clearUndo();
  } finally { importing=false; }
  refresh();
}
function refresh() {
  const issues=designDiagnostics(w);
  for(const b of w.getAllBlocks(false))b.setWarningText(issues.filter(i=>i.id===b.id).map(i=>i.message).join('\n')||null,'design');
  const panel=host.querySelector('#diagnostics');panel.replaceChildren();
  const messages=[storageError,...issues.map(i=>`${i.type}: ${i.message}`)].filter(Boolean);
  if(!messages.length)messages.push('Cấu trúc hợp lệ để duyệt kéo thả. Chưa có generator cho thiết kế mới.');
  for(const message of messages){const p=document.createElement('p');p.textContent=message;panel.append(p);}
  try {localStorage.setItem(storageKey,JSON.stringify(saveDesign(w)));}catch{storageError='Không lưu được bản thử nghiệm; hãy tải tệp xuống.';}
}
let timer;
w.addChangeListener(e=>{if(importing||e.isUiEvent||e.type===Blockly.Events.BLOCK_CHANGE&&e.element==='warning')return;clearTimeout(timer);timer=setTimeout(refresh,120);});
try {
  const stored=localStorage.getItem(storageKey);
  if(stored)replace(JSON.parse(stored));else {const root=initializeDesign(w);root.initSvg();root.render();root.moveBy(50,40);}
} catch(error) {
  // Never overwrite unreadable persisted content on startup.
  importing=true;
  host.querySelector('#diagnostics').textContent='Không mở được bản thử nghiệm đã lưu: '+error.message;
}
host.querySelector('#example').addEventListener('change',async e=>{
  if(!await confirmReplacement('Thay nội dung vùng thử nghiệm? Hãy lưu tệp trước nếu muốn giữ bản hiện tại.')){e.target.value=selectedExample;return;}
  const payload=e.target.value?exampleDesign(e.target.value):(()=>{const empty=new Blockly.Workspace(new Blockly.Options(workspaceOptions));initializeDesign(empty);const data=saveDesign(empty);empty.dispose();return data;})();
  replace(payload);selectedExample=e.target.value;
});
host.querySelector('#save').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(saveDesign(w),null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='newmania-blockly.design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
host.querySelector('#open').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try {const payload=JSON.parse(await file.text());const check=loadDesign(payload);check.dispose();if(await confirmReplacement('Mở bản thử nghiệm này thay cho nội dung đang xem?')){replace(payload);selectedExample='';host.querySelector('#example').value='';}}
  catch(error){showError(error.message);}
});
new ResizeObserver(()=>Blockly.svgResize(w)).observe(host.querySelector('#workspace'));
if(!importing){w.clearUndo();refresh();}
