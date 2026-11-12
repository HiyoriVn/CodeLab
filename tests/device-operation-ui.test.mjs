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
  export function Harness() {
    const operation=useDeviceOperation();
    const [open,setOpen]=React.useState(true);
    return <Modal open={open} locked={operation.busy} onClose={()=>setOpen(false)} title="Connect">
      <DevicePanel operation={operation} boardId={FAST4WD_BOARD_ID} code="sketch" warnings={[]} />
      <BrowserFlasher operation={operation} boardId={FAST4WD_BOARD_ID}/>
      <button disabled={operation.busy} onClick={()=>{if(!operation.isBusy())setOpen(false)}}>Đóng</button>
    </Modal>;
  }`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,packages:'external',format:'esm',platform:'node',jsx:'automatic',outfile:resolve(folder,'harness.mjs')});
const { Harness } = await import(pathToFileURL(resolve(folder,'harness.mjs')));
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
  Object.defineProperty(window,'isSecureContext',{value:true});window.confirm=()=>true;
  let chooser=deferred(), upload=deferred(), compile=deferred(), chooseCalls=0,uploadCalls=0,compileCalls=0;
  navigator.serial={requestPort:()=>{++chooseCalls;return chooser.promise;}};
  const oldFetch=globalThis.fetch, requests=[];
  globalThis.fetch=async path=>{
    requests.push(path);
    if(path==='/api/status')return response({ready:true});
    if(path==='/api/ports')return response({ports:[{address:'MOCK',label:'MOCK',fast4wdCompatible:true}]});
    if(path==='/api/compile'){++compileCalls;return compile.promise;}
    if(path==='/api/upload'){++uploadCalls;return upload.promise;}
    throw Error('Unexpected request '+path);
  };
  const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root'));
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label);
  const browser=()=>button('Chọn USB và nạp…'),bridge=()=>button('Nạp lên bo mạch…');
  const click=async element=>act(async()=>{element.click();await tick();});
  try {
    await act(async()=>{root.render(createElement(Harness));await tick();});
    const f=fixture(), input=document.querySelector('input[type=file]');
    Object.defineProperty(input,'files',{value:[{name:'manifest.json',text:async()=>JSON.stringify(f.manifest)},...f.files]});
    await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,40));});
    await click(document.querySelector('section[aria-label="Nạp firmware từ trình duyệt"] input[type=checkbox]'));
    assert.equal(browser().disabled,false);
    // Compile request owns the same lock, before any USB chooser can open.
    await act(async()=>{button('Biên dịch').click();button('Biên dịch').click();});
    assert.equal(compileCalls,1);assert.equal(browser().disabled,true);
    await act(async()=>{compile.resolve(response({buildId:'mock-build'}));await tick();});
    const port=document.querySelector('select');
    await act(async()=>{port.value='MOCK';port.dispatchEvent(new window.Event('change',{bubbles:true}));});
    await click(document.querySelector('.device-panel input[type=checkbox]'));
    await click(bridge());assert.equal(uploadCalls,1);assert.equal(browser().disabled,true);
    assert.equal(button('Đóng').disabled,true);
    const cancel=new window.Event('cancel',{cancelable:true});
    await act(async()=>{document.querySelector('dialog').dispatchEvent(cancel);document.querySelector('dialog').click();});
    assert.equal(cancel.defaultPrevented,true);assert.ok(document.querySelector('dialog').open);
    await act(async()=>{upload.resolve(response({}));await tick();});
    assert.equal(browser().disabled,false);
    for(const error of [Object.assign(Error('cancelled'),{name:'NotFoundError'}),Error('USB failed')]){
      await act(async()=>{browser().click();browser().click();});
      assert.equal(bridge().disabled,true);assert.equal(button('Biên dịch').disabled,true);
      assert.equal(button('Đóng').disabled,true);
      await act(async()=>{chooser.reject(error);await tick();});
      assert.equal(button('Biên dịch').disabled,false);assert.equal(button('Đóng').disabled,false);
      assert.equal(browser().disabled,true); // Confirmation must be made again.
      await click(document.querySelector('section[aria-label="Nạp firmware từ trình duyệt"] input[type=checkbox]'));
      chooser=deferred();
    }
    assert.equal(chooseCalls,2);
    // A failed bridge upload also releases the owner and restores the modal.
    upload=deferred();
    await click(document.querySelector('.device-panel input[type=checkbox]'));
    await click(bridge());assert.equal(uploadCalls,2);
    await act(async()=>{upload.reject(Error('bridge disconnected'));await tick();});
    assert.equal(button('Đóng').disabled,false);assert.equal(browser().disabled,false);
    assert.match(document.querySelector('.device-message').textContent,/bridge disconnected/);
    await click(button('Đóng'));assert.equal(document.querySelector('dialog').open,false);
    const beforeRequests=requests.length;
    dom.reconfigure({url:'https://example.pages.dev/'});
    await act(async()=>{root.render(createElement(Harness,{key:'static'}));await tick();});
    assert.equal(requests.length,beforeRequests);
    assert.equal(button('Làm mới cổng').disabled,true);
    assert.equal(button('Biên dịch').disabled,true);
    assert.match(document.querySelector('.device-message').textContent,/Website tĩnh/);
  } finally {
    await act(async()=>root.unmount());dom.window.close();globalThis.fetch=oldFetch;
    for(const [name,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});
