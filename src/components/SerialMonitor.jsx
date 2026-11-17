import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSerialError } from '../device/usb-port.js';

const MAX_LINES = 500;

async function closeSerialPort(port, reader) {
  try { await reader?.cancel(); } catch {}
  await new Promise((resolve) => setTimeout(resolve, 0));
  try { await port?.close(); } catch {}
}

function SerialMonitor({ usbPort }) {
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const outputRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [baud, setBaud] = useState('115200');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState(['CodeLab serial monitor', 'Chưa kết nối thiết bị.']);

  const append = useCallback((line) => {
    setLines((current) => [...current.slice(-(MAX_LINES - 1)), line]);
  }, []);

  const disconnect = useCallback(async ({ silent = false } = {}) => {
    const port = portRef.current;
    portRef.current = null;
    if (port) {
      await closeSerialPort(port, readerRef.current);
      setConnected(false);
      if (!silent) append('Đã ngắt kết nối.');
    }
  }, [append]);

  useEffect(() => {
    usbPort?.registerSerialCloser?.(async () => {
      if (portRef.current) {
        await disconnect({ silent: true });
        append('Đã tạm ngắt Serial để nạp/kiểm tra thiết bị.');
      }
    });
    return () => { usbPort?.registerSerialCloser?.(null); };
  }, [usbPort, disconnect, append]);

  useEffect(() => () => {
    const port = portRef.current;
    portRef.current = null;
    void closeSerialPort(port, readerRef.current);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    const serial = typeof navigator !== 'undefined' ? navigator.serial : undefined;
    if (!serial?.addEventListener) return undefined;
    const onDisconnect = (event) => {
      if (event?.target && event.target === portRef.current) {
        portRef.current = null;
        readerRef.current = null;
        setConnected(false);
        append('Thiết bị USB đã ngắt kết nối.');
      }
    };
    serial.addEventListener('disconnect', onDisconnect);
    return () => serial.removeEventListener('disconnect', onDisconnect);
  }, [append]);

  const connect = async ({ forceNew = false } = {}) => {
    if (!navigator.serial) {
      append('Trình duyệt này chưa hỗ trợ Web Serial. Hãy dùng Chrome hoặc Edge trên máy tính.');
      return;
    }
    try {
      if (portRef.current) await disconnect({ silent: true });
      const port = usbPort ? await usbPort.selectPort({ forceNew }) : await navigator.serial.requestPort();
      await port.open({ baudRate: Number(baud) });
      portRef.current = port;
      setConnected(true);
      append(`Đã kết nối · ${baud} baud`);
      const decoder = new TextDecoder();
      while (port.readable && portRef.current === port) {
        const reader = port.readable.getReader();
        readerRef.current = reader;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = decoder.decode(value, { stream: true });
              if (!text) continue;
              setLines((current) => {
                const parts = text.split(/\r?\n/);
                const prior = current.slice();
                const last = prior.pop() || '';
                const combined = last + parts[0];
                if (parts.length > 1) prior.push(combined, ...parts.slice(1, -1));
                prior.push(parts.length > 1 ? parts.at(-1) : combined);
                return prior.slice(-MAX_LINES);
              });
            }
          }
        } catch (error) {
          if (portRef.current === port) append(`Đọc cổng thất bại: ${formatSerialError(error)}`);
        } finally {
          reader.releaseLock();
          if (readerRef.current === reader) readerRef.current = null;
        }
      }
    } catch (error) {
      if (error.name !== 'NotFoundError') append(`Không thể kết nối: ${formatSerialError(error)}`);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    const port = portRef.current;
    if (!port?.writable || !command.trim()) return;
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${command}\n`));
      append(`› ${command}`);
      setCommand('');
    } catch (error) {
      append(`Gửi lệnh thất bại: ${formatSerialError(error)}`);
    } finally {
      writer.releaseLock();
    }
  };

  const hasSharedPort = Boolean(usbPort?.port);
  return (
    <section className="serial-panel" aria-label="Bảng lệnh serial">
      <div className="serial-heading">
        <span className={`connection-pill ${connected ? 'is-connected' : ''}`}>
          <i />{connected ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
        <button className="clear-console" onClick={() => setLines([])}>Xóa log</button>
      </div>
      <div className="serial-settings">
        <label>
          Tốc độ truyền
          <select value={baud} onChange={(event) => setBaud(event.target.value)} disabled={connected}>
            <option value="9600">9600</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
            <option value="230400">230400</option>
          </select>
        </label>
        {connected ? (
          <button className="button button-quiet" onClick={() => disconnect()}>Ngắt kết nối</button>
        ) : (
          <>
            <button className="button button-primary" onClick={() => connect({ forceNew: false })}>
              {hasSharedPort ? `Kết nối (${usbPort.portLabel})` : 'Chọn cổng & kết nối'}
            </button>
            {hasSharedPort && (
              <button className="button button-quiet" onClick={() => connect({ forceNew: true })}>Đổi cổng</button>
            )}
          </>
        )}
      </div>
      <pre ref={outputRef} className="serial-output" aria-live="polite">{lines.join('\n')}</pre>
      <form className="serial-input" onSubmit={send}>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Nhập lệnh serial…"
          aria-label="Lệnh serial"
          disabled={!connected}
        />
        <button className="button button-primary" disabled={!connected || !command.trim()}>Gửi</button>
      </form>
      <small className="serial-note">
        Dùng chung cổng USB với trình nạp. Nếu báo cổng bận, hãy đóng Arduino IDE hoặc Serial Monitor khác.
      </small>
    </section>
  );
}
export default SerialMonitor;
