import { useEffect, useRef, useState } from 'react';

async function closeSerialPort(port, reader) {
  try { await reader?.cancel(); } catch {}
  await new Promise((resolve) => setTimeout(resolve, 0));
  try { await port?.close(); } catch {}
}

function SerialMonitor() {
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [baud, setBaud] = useState('115200');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState(['CodeLab serial monitor', 'Chưa kết nối thiết bị.']);
  useEffect(() => () => {
    const port = portRef.current; portRef.current = null;
    void closeSerialPort(port, readerRef.current);
  }, []);
  const append = (line) => setLines((current) => [...current.slice(-299), line]);
  const connect = async () => {
    if (!navigator.serial) { append('Trình duyệt này chưa hỗ trợ Web Serial. Hãy dùng Chrome hoặc Edge trên máy tính.'); return; }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: Number(baud) });
      portRef.current = port;
      setConnected(true);
      append(`Đã kết nối · ${baud} baud`);
      const decoder = new TextDecoder();
      while (port.readable && portRef.current === port) {
        const reader = port.readable.getReader(); readerRef.current = reader;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) setLines((current) => {
              const text = decoder.decode(value, { stream: true });
              const parts = text.split(/\r?\n/);
              const prior = current.slice();
              const last = prior.pop() || '';
              const combined = last + parts[0];
              if (parts.length > 1) prior.push(combined, ...parts.slice(1, -1));
              prior.push(parts.length > 1 ? parts.at(-1) : combined);
              return prior.slice(-300);
            });
          }
        } catch (error) { if (portRef.current === port) append(`Đọc cổng thất bại: ${error.message}`); }
        finally { reader.releaseLock(); if (readerRef.current === reader) readerRef.current = null; }
      }
    } catch (error) {
      if (error.name !== 'NotFoundError') append(`Không thể kết nối: ${error.message}`);
    }
  };
  const disconnect = async () => {
    const port = portRef.current; portRef.current = null;
    await closeSerialPort(port, readerRef.current);
    setConnected(false); append('Đã ngắt kết nối.');
  };
  const send = async (event) => {
    event.preventDefault(); const port = portRef.current;
    if (!port?.writable || !command.trim()) return;
    const writer = port.writable.getWriter();
    try { await writer.write(new TextEncoder().encode(`${command}\n`)); append(`› ${command}`); setCommand(''); }
    catch (error) { append(`Gửi lệnh thất bại: ${error.message}`); }
    finally { writer.releaseLock(); }
  };
  return <section className="serial-panel" aria-label="Bảng lệnh serial"><div className="serial-heading"><span className={`connection-pill ${connected ? 'is-connected' : ''}`}><i />{connected ? 'Đã kết nối' : 'Chưa kết nối'}</span><button className="clear-console" onClick={() => setLines([])}>Xóa log</button></div><div className="serial-settings"><label>Tốc độ truyền<select value={baud} onChange={(event) => setBaud(event.target.value)} disabled={connected}><option value="9600">9600</option><option value="57600">57600</option><option value="115200">115200</option><option value="230400">230400</option></select></label>{connected ? <button className="button button-quiet" onClick={disconnect}>Ngắt kết nối</button> : <button className="button button-primary" onClick={connect}>Chọn cổng & kết nối</button>}</div><pre className="serial-output" aria-live="polite">{lines.join('\n')}</pre><form className="serial-input" onSubmit={send}><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Nhập lệnh serial…" aria-label="Lệnh serial" disabled={!connected} /><button className="button button-primary" disabled={!connected || !command.trim()}>Gửi</button></form><small className="serial-note">Lệnh gửi kèm ký tự xuống dòng. Kết nối serial dùng Web Serial, cần trình duyệt tương thích và thao tác chọn cổng.</small></section>;
}
export default SerialMonitor;



