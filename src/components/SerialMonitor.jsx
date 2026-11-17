import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSerialError } from '../device/usb-port.js';
import { createSerialSession } from '../device/serial-lifecycle.js';

const MAX_LINES = 500;

function SerialMonitor({ usbPort }) {
  const portRef = useRef(null);
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = createSerialSession();
  const connectingRef = useRef(false);
  const epochRef = useRef(0);
  const outputRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [baud, setBaud] = useState('115200');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState(['CodeLab serial monitor', 'Chưa kết nối thiết bị.']);

  const append = useCallback((line) => {
    setLines((current) => [...current.slice(-(MAX_LINES - 1)), line]);
  }, []);

  const disconnect = useCallback(async ({ silent = false } = {}) => {
    epochRef.current++;
    portRef.current = null;
    await sessionRef.current.disconnect();
    setConnected(false);
    if (!silent) append('Đã ngắt kết nối.');
  }, [append]);

  useEffect(() => {
    usbPort?.registerSerialCloser?.(async () => {
      await disconnect({ silent: true });
      append('Đã tạm ngắt Serial để nạp/kiểm tra thiết bị.');
    });
    return () => { usbPort?.registerSerialCloser?.(null); };
  }, [usbPort, disconnect, append]);

  useEffect(() => () => {
    epochRef.current++;
    portRef.current = null;
    void sessionRef.current.disconnect().catch(() => {});
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
        void sessionRef.current.disconnect().catch(() => {});
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
    if (connectingRef.current) return;
    connectingRef.current = true;
    try {
      if (portRef.current) await disconnect({ silent: true });
      const epoch = epochRef.current;
      const port = usbPort ? await usbPort.selectPort({ forceNew }) : await navigator.serial.requestPort();
      if (epoch !== epochRef.current) return;
      const decoder = new TextDecoder();
      await sessionRef.current.connect(port, { baudRate: Number(baud) }, (value) => {
        const text = decoder.decode(value, { stream: true });
        if (!text) return;
        setLines((current) => {
          const parts = text.split(/\r?\n/);
          const prior = current.slice();
          const last = prior.pop() || '';
          const combined = last + parts[0];
          if (parts.length > 1) prior.push(combined, ...parts.slice(1, -1));
          prior.push(parts.length > 1 ? parts.at(-1) : combined);
          return prior.slice(-MAX_LINES);
        });
      }, (error) => append(`Đọc cổng thất bại: ${formatSerialError(error)}`));
      if (epoch !== epochRef.current) {
        await sessionRef.current.disconnect();
        return;
      }
      portRef.current = port;
      setConnected(true);
      append(`Đã kết nối · ${baud} baud`);
    } catch (error) {
      if (error.name !== 'NotFoundError') append(`Không thể kết nối: ${formatSerialError(error)}`);
    } finally { connectingRef.current = false; }
  };

  const send = async (event) => {
    event.preventDefault();
    const port = portRef.current;
    if (!port?.writable || !command.trim()) return;
    try {
      await sessionRef.current.write(new TextEncoder().encode(`${command}\n`));
      append(`› ${command}`);
      setCommand('');
    } catch (error) {
      append(`Gửi lệnh thất bại: ${formatSerialError(error)}`);
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
