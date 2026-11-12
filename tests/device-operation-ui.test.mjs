import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { fixture } from './fixtures/browser-firmware.mjs';

const folder = resolve('firmware/tests/build-output/device-ui');
mkdirSync(folder, {recursive:true});
await build({stdin:{contents:`
  import React from 'react';
  import DevicePanel from './src/components/DevicePanel.jsx';
  import BrowserFlasher from './src/components/BrowserFlasher.jsx';
  import Modal from './src/ui/Modal.jsx';
  import {useDeviceOperation} from './src/device/useDeviceOperation.js';
  import {FAST4WD_BOARD_ID} from './src/boards/profiles.js';
  export {setBrowserCompilerEnabled} from './src/compiler/config.js';
  export function Harness({code='sketch'}) {
    const operation=useDeviceOperation();
    const [open,setOpen]=React.useState(true);
    return <Modal open={open} locked={operation.busy} onClose={()=>setOpen(false)} title="Connect">
      <DevicePanel operation={operation} boardId={FAST4WD_BOARD_ID} code={code} warnings={[]} />
      <BrowserFlasher operation={operation} boardId={FAST4WD_BOARD_ID}/>
      <button disabled={operation.busy} onClick={()=>{if(!operation.isBusy())setOpen(false)}}>Đóng</button>
    </Modal>;
  }`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,packages:'external',format:'esm',platform:'node',jsx:'automatic',outfile:resolve(folder,'harness.mjs')});
const { Harness, setBrowserCompilerEnabled } = await import(pathToFileURL(resolve(folder,'harness.mjs')));
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const response = data => ({ok:true,json:async()=>data});
const tick = () => new Promise(resolve=>setTimeout(resolve,10));

test('real React panels lock each other, modal and repeated clicks; recover after USB cancel/error', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/'});
  const saved = new Map();
  for (const [name,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
  }
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  Object.defineProperty(window,'isSecureContext',{value:true});
  const confirmations=[];let confirmation=true;
  window.confirm=message=>{confirmations.push(message);return confirmation;};
  let chooser=deferred(), upload=deferred(), compile=deferred(), chooseCalls=0,uploadCalls=0,compileCalls=0;
  navigator.serial={requestPort:()=>{++chooseCalls;return chooser.promise;}};
  const oldFetch=globalThis.fetch, requests=[],uploadPayloads=[];
  globalThis.fetch=async (path,options)=>{
    requests.push(path);
    if(path==='/api/status')return response({ready:true});
    if(path==='/api/ports')return response({ports:[{address:'MOCK',label:'MOCK',fast4wdCompatible:true}]});
    if(path==='/api/compile'){++compileCalls;return compile.promise;}
    if(path==='/api/upload'){++uploadCalls;uploadPayloads.push(JSON.parse(options.body));return upload.promise;}
    throw Error('Unexpected request '+path);
  };
  const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
  const browser=()=>button('Chọn USB và nạp firmware có sẵn'),bridge=()=>button('Nạp qua bridge');
  const click=async element=>act(async()=>{element.click();await tick();});
  const waitFor=async predicate=>{
    for(let i=0;i<200;i++){
      if(predicate())return;
      await act(async()=>{await tick();});
    }
    assert.fail('UI did not reach the expected state');
  };
  try {
    await act(async()=>{root.render(createElement(Harness));await tick();});
    const technical=document.querySelector('section[aria-label="Nạp firmware từ trình duyệt"]').closest('details');
    assert.equal(technical.open,false);
    await click(technical.querySelector('summary'));assert.equal(technical.open,true);
    assert.equal(button('Chọn USB và nạp').disabled,true);
    assert.equal(document.querySelectorAll('input[type=checkbox]').length,0);
    const f=fixture(), input=document.querySelector('input[type=file]');
    Object.defineProperty(input,'files',{configurable:true,value:[{name:'manifest.json',text:async()=>'null'}]});
    await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();});
    assert.equal(browser().disabled,true);assert.equal(chooseCalls,0);
    Object.defineProperty(input,'files',{configurable:true,value:[{name:'manifest.json',text:async()=>JSON.stringify(f.manifest)},...f.files]});
    await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));});
    await waitFor(()=>!browser().disabled);
    assert.equal(browser().disabled,false);
    // Compile request owns the same lock, before any USB chooser can open.
    await act(async()=>{button('Biên dịch chương trình').click();button('Biên dịch chương trình').click();});
    assert.equal(compileCalls,1);assert.equal(browser().disabled,true);
    await act(async()=>{compile.resolve(response({buildId:'mock-build',boardId:f.manifest.boardId}));await tick();});
    const port=document.querySelector('select');
    await act(async()=>{port.value='MOCK';port.dispatchEvent(new window.Event('change',{bubbles:true}));});
    confirmation=false;await click(bridge());assert.equal(uploadCalls,0);
    confirmation=true;
    await click(bridge());assert.equal(uploadCalls,1);assert.equal(browser().disabled,true);
    assert.equal(uploadPayloads[0].confirmed,true);assert.equal(uploadPayloads[0].hardwareConfirmed,true);
    assert.equal(button('Đóng').disabled,true);
    const cancel=new window.Event('cancel',{cancelable:true});
    await act(async()=>{document.querySelector('dialog').dispatchEvent(cancel);document.querySelector('dialog').click();});
    assert.equal(cancel.defaultPrevented,true);assert.ok(document.querySelector('dialog').open);
    await act(async()=>{upload.resolve(response({}));await tick();});
    assert.equal(browser().disabled,false);
    for(const error of [Object.assign(Error('cancelled'),{name:'NotFoundError'}),Error('USB failed')]){
      await act(async()=>{browser().click();browser().click();});
      assert.equal(bridge().disabled,true);assert.equal(button('Biên dịch chương trình').disabled,true);
      assert.equal(button('Đóng').disabled,true);
      await act(async()=>{chooser.reject(error);await tick();});
      assert.equal(button('Biên dịch chương trình').disabled,false);assert.equal(button('Đóng').disabled,false);
      assert.equal(browser().disabled,false);
      chooser=deferred();
    }
    assert.equal(chooseCalls,2);
    const beforeConfirmation=confirmations.length;
    confirmation=false;
    await click(browser());assert.equal(confirmations.length,beforeConfirmation);
    await act(async()=>{chooser.resolve({});await tick();});
    assert.equal(confirmations.length,beforeConfirmation+1);
    assert.match(confirmations.at(-1),/Hãy ngắt nguồn động cơ/);
    assert.match(document.querySelector('section[aria-label="Nạp firmware từ trình duyệt"] pre').textContent,/Đã hủy nạp/);
    confirmation=true;
    // A failed bridge upload also releases the owner and restores the modal.
    upload=deferred();
    await click(bridge());assert.equal(uploadCalls,2);
    await act(async()=>{upload.reject(Error('bridge disconnected'));await tick();});
    assert.equal(button('Đóng').disabled,false);assert.equal(browser().disabled,false);
    assert.match(document.querySelector('.device-message').textContent,/Không thể nạp chương trình/);
    window.localStorage.setItem('codelab.projects.v1','unchanged-project');
    await act(async()=>{root.render(createElement(Harness,{code:'changed sketch'}));await tick();});
    assert.equal(bridge().disabled,true);
    assert.match(document.querySelector('.device-panel').textContent,/chương trình đã thay đổi/);
    assert.equal(window.localStorage.getItem('codelab.projects.v1'),'unchanged-project');
    compile=deferred();await click(button('Biên dịch chương trình'));
    assert.match(document.querySelector('.device-panel').textContent,/Đang biên dịch/);
    await act(async()=>{compile.reject(Error('internal compiler detail'));await tick();});
    assert.match(document.querySelector('.device-panel').textContent,/Thất bại/);
    assert.doesNotMatch(document.querySelector('.device-panel').textContent,/internal compiler detail/);
    await click(button('Đóng'));
    // Bách's modal keeps the native dialog open through its closing animation.
    await waitFor(()=>!document.querySelector('dialog').open);
    const beforeRequests=requests.length;
    dom.reconfigure({url:'https://example.pages.dev/'});
    await act(async()=>{root.render(createElement(Harness,{key:'static'}));await tick();});
    assert.equal(requests.length,beforeRequests);
    assert.equal(button('Làm mới cổng'),undefined);
    assert.equal(button('Biên dịch chương trình').disabled,true);
    assert.match(document.querySelector('.device-panel').textContent,/Chức năng biên dịch trên website đang được phát triển/);
    assert.equal(button('Chọn USB và nạp').disabled,true);
    assert.doesNotMatch(document.querySelector('.device-panel').textContent,/manifest|partition|app0|bootloader|OTA|NVS|Arduino CLI|localhost/i);
    assert.doesNotMatch(document.querySelector('.device-panel').textContent,/Thành công|Hoàn tất/);
    assert.equal(document.querySelector('section[aria-label="Nạp firmware từ trình duyệt"]').closest('details').open,false);
    await click(button('Biên dịch chương trình'));await click(button('Chọn USB và nạp'));
    assert.equal(requests.length,beforeRequests);assert.equal(chooseCalls,3);
    // A local bridge is optional when WASM is enabled. Its absence must not
    // present a failure to a student who can compile entirely in the browser.
    dom.reconfigure({url:'http://localhost/'});
    setBrowserCompilerEnabled(true);
    globalThis.fetch=async()=>{throw Error('No local bridge');};
    await act(async()=>{root.render(createElement(Harness,{key:'wasm-no-bridge'}));await tick();});
    assert.equal(button('Biên dịch chương trình').disabled,false);
    assert.doesNotMatch(document.querySelector('.device-panel').textContent,/Chưa kết nối được công cụ phát triển/);
    setBrowserCompilerEnabled(false);
  } finally {
    await act(async()=>root.unmount());dom.window.close();globalThis.fetch=oldFetch;
    for(const [name,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});
