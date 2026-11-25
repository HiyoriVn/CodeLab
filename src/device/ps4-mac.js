import { createSerialSession } from './serial-lifecycle.js';

const MAC = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const encoder = new TextEncoder();

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

class ReplyTimeout extends Error {}

export async function managePs4Mac(port, { expectedMac, readTimeout = 1100, resetTimeout = 4000 } = {}) {
  const session = createSerialSession();
  const decoder = new TextDecoder();
  let pending;
  let line = '';
  let discard = false;

  function onData(chunk) {
    for (const char of decoder.decode(chunk, { stream: true })) {
      if (char === '\n') {
        if (!discard && pending && line.startsWith(pending.prefix)) {
          pending.resolve(line.slice(pending.prefix.length).replace(/\r$/, ''));
        }
        line = '';
        discard = false;
      } else if (line.length >= 96) {
        discard = true;
      } else if (!discard) {
        line += char;
      }
    }
  }

  async function exchange(command, timeout) {
    const id = token();
    let timer;
    const reply = new Promise((resolve, reject) => {
      pending = { prefix: `CLPS4 ${id} `, resolve, reject };
      timer = setTimeout(() => reject(new ReplyTimeout()), timeout);
    });
    try {
      const [result] = await Promise.all([reply, session.write(encoder.encode(`\nCLPS4${command} ${id}\n`))]);
      return result;
    } finally {
      clearTimeout(timer);
      pending = undefined;
    }
  }

  try {
    await session.connect(port, { baudRate: 115200 }, onData, (error) => pending?.reject(error));
    let reply;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        reply = await exchange('?', readTimeout);
        break;
      } catch (error) {
        if (!(error instanceof ReplyTimeout)) throw error;
      }
    }
    if (reply === undefined) {
      throw new Error('D1 không phản hồi. Hãy kiểm tra COM và firmware cầu PS4 trên D1.');
    }
    const mac = reply.startsWith('MAC ') ? reply.slice(4) : '';
    if (mac !== 'NONE' && mac !== 'INVALID' && !MAC.test(mac)) {
      throw new Error('Không đọc được MAC đã lưu trên D1.');
    }
    if (expectedMac === undefined || expectedMac !== mac) return { mac, reset: false };

    let result;
    try {
      result = await exchange('!', resetTimeout);
    } catch {
      throw new Error('Mất phản hồi khi reset. Hãy đọc lại MAC để kiểm tra kết quả.');
    }
    if (result !== 'OK') throw new Error('D1 báo lỗi khi xóa MAC. Hãy đọc lại MAC rồi thử lại.');
    return { mac: 'NONE', reset: true };
  } finally {
    await session.disconnect();
  }
}
