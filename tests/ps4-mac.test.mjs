import assert from 'node:assert/strict';
import test from 'node:test';
import { managePs4Mac } from '../src/device/ps4-mac.js';

const MAC = '02:12:34:56:78:9A';
const encoder = new TextEncoder();

function mockPort(respond) {
  const commands = [];
  let closed = false;
  const port = {
    async open({ baudRate }) {
      assert.equal(baudRate, 115200);
      let input;
      this.readable = new ReadableStream({ start(controller) { input = controller; } });
      this.writable = new WritableStream({ write(bytes) {
        const line = new TextDecoder().decode(bytes);
        assert.doesNotMatch(line, /[rR]/, 'The legacy D1 byte parser must not see a reset character');
        const [, verb, id] = /^\nCLPS4([?!]) ([a-f0-9]{12})\n$/.exec(line);
        commands.push(verb);
        const outcome = respond(verb, commands.length);
        input.enqueue(encoder.encode(`BT=0 seq=64\r\nCLPS4 ${id === '000000000000' ? 'ffffffffffff' : '000000000000'} OK\r\n`));
        if (outcome) {
          input.enqueue(encoder.encode(`CLPS4 ${id} `));
          input.enqueue(encoder.encode(`${outcome}\r\n`));
        }
      } });
    },
    async close() {
      assert.equal(this.readable.locked, false);
      assert.equal(this.writable.locked, false);
      closed = true;
    },
  };
  return { port, commands, isClosed: () => closed };
}

test('reads the saved controller MAC without issuing reset and handles noisy split replies', async () => {
  const mock = mockPort(() => `MAC ${MAC}`);
  assert.deepEqual(await managePs4Mac(mock.port), { mac: MAC, reset: false });
  assert.deepEqual(mock.commands, ['?']);
  assert.ok(mock.isClosed());
});

test('rechecks MAC and resets once after the bridge acknowledges', async () => {
  const mock = mockPort((verb) => verb === '?' ? `MAC ${MAC}` : 'OK');
  assert.deepEqual(await managePs4Mac(mock.port, { expectedMac: MAC }), { mac: 'NONE', reset: true });
  assert.deepEqual(mock.commands, ['?', '!']);
  assert.ok(mock.isClosed());
});

test('a changed MAC or unsupported D1 firmware cannot receive a reset command', async () => {
  const changed = mockPort(() => 'MAC NONE');
  assert.deepEqual(await managePs4Mac(changed.port, { expectedMac: MAC }), { mac: 'NONE', reset: false });
  assert.deepEqual(changed.commands, ['?']);

  const silent = mockPort(() => undefined);
  await assert.rejects(managePs4Mac(silent.port, { expectedMac: MAC, readTimeout: 8 }), /D1 không phản hồi/);
  assert.deepEqual(silent.commands, ['?', '?', '?']);
  assert.ok(silent.isClosed());
});

test('a failed or unacknowledged reset never reports success or retransmits reset', async () => {
  for (const reply of ['FAIL', undefined]) {
    const mock = mockPort((verb) => verb === '?' ? 'MAC INVALID' : reply);
    await assert.rejects(managePs4Mac(mock.port, { expectedMac: 'INVALID', resetTimeout: 8 }), /đọc lại MAC/i);
    assert.deepEqual(mock.commands, ['?', '!']);
    assert.ok(mock.isClosed());
  }
});
