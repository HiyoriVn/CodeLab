import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import '../src/blocks/beginner.js';
import '../src/blocks/fast4wd.js';
import '../src/blocks/robot-devices.js';
import { generateArduino } from '../src/generators/arduino.js';
import { createBridge } from './arduino-bridge.mjs';

const cli = process.env.ARDUINO_CLI_PATH || 'arduino-cli';
const version = execFileSync(cli, ['version'], { encoding: 'utf8', windowsHide: true }).trim();
assert.match(version, /Version:\s+1\.5\.1\b/);
console.log(version);
const examples = ['lesson_ps4_4wd', 'lesson_robot_mecanum', 'lesson_robot_motor_events'];
const selected = process.argv.length > 2 ? process.argv.slice(2) : examples;

function compile(port, generated) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(generated);
    const req = request({
      hostname: '127.0.0.1', port, path: '/api/compile', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, async res => {
      try {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        resolve({ status: res.statusCode, result: JSON.parse(Buffer.concat(chunks).toString()) });
      } catch (error) {
        reject(error);
      }
    });
    req.setTimeout(420_000, () => req.destroy(new Error('Compile request timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

// Exercise the production compile endpoint. This script never lists ports or uploads.
const server = createBridge().listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  for (const name of selected) {
    assert.ok(examples.includes(name), 'Unknown example: ' + name);
    const { project } = JSON.parse(await readFile(
      new URL(`../examples/beginner/${name}/${name}.codelab.json`, import.meta.url), 'utf8',
    ));
    const workspace = new Blockly.Workspace();
    let generated;
    try {
      Blockly.serialization.workspaces.load(project.workspace, workspace);
      generated = generateArduino(workspace, project.boardId, project.deviceConfigs?.[project.boardId]);
    } finally {
      workspace.dispose();
    }
    assert.deepEqual(generated.warnings, []);
    console.log(name + '\n' + generated.code);
    const { status, result } = await compile(server.address().port, generated);
    console.log(result);
    assert.ok(status === 200 && result.binaryBytes > 0, 'Arduino compile failed: ' + name);
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
