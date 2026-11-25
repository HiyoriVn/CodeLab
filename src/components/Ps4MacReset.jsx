import { useEffect, useRef, useState } from 'react';
import { managePs4Mac } from '../device/ps4-mac.js';
import { describeSerialPort, formatSerialError } from '../device/usb-port.js';
import { D1_DEFAULT_PINS, D1_PINS, validateD1Config } from '../device/d1-firmware-config.js';
import { flashD1Firmware } from '../device/browser-flash.js';
import { compileD1InBrowser } from '../compiler/d1-compiler-client.js';

export default function Ps4MacReset({ operation, usbPort, onClose }) {
  const port = useRef(null);
  const [label, setLabel] = useState('');
  const [mac, setMac] = useState();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const [mode, setMode] = useState('i2c');
  const [pins, setPins] = useState(D1_DEFAULT_PINS.i2c);
  const [flashStatus, setFlashStatus] = useState('');
  const [flashError, setFlashError] = useState('');
  const [hardwareConfirmed, setHardwareConfirmed] = useState(false);
  const [toolchain, setToolchain] = useState(null);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => {
    const serial = navigator.serial;
    function disconnected(event) {
      if (event.target !== port.current) return;
      port.current = null;
      setLabel('');
      setMac(undefined);
      setHardwareConfirmed(false);
      setError('D1 đã ngắt kết nối USB. Hãy chọn lại COM.');
    }
    serial?.addEventListener('disconnect', disconnected);
    return () => serial?.removeEventListener('disconnect', disconnected);
  }, []);

  async function run(action) {
    const release = operation.acquire();
    if (!release) return;
    setError('');
    setResetDone(false);
    let chosen = port.current;
    try {
      if (!navigator.serial) throw new Error('Hãy mở CodeLab bằng Chrome hoặc Edge trên máy tính để chọn COM.');
      if (action === 'choose') {
        setStatus('Đang chờ chọn COM…');
        chosen = await navigator.serial.requestPort();
        port.current = chosen;
        setLabel(describeSerialPort(chosen));
        setHardwareConfirmed(false);
      }
      if (!chosen) return;
      setMac(undefined);
      setStatus(action === 'reset' ? 'Đang kiểm tra và reset MAC…' : 'Đang đọc MAC trên D1…');
      if (chosen === usbPort.port) await usbPort.releaseForFlash();
      const result = await managePs4Mac(chosen, { expectedMac: action === 'reset' ? mac : undefined });
      if (port.current !== chosen) return;
      setMac(result.mac);
      setResetDone(result.reset);
      if (action === 'reset' && !result.reset) setError('MAC trên D1 vừa thay đổi. Kiểm tra MAC mới rồi bấm Reset MAC để xác nhận.');
    } catch (failure) {
      if (failure.name !== 'NotFoundError') setError(formatSerialError(failure));
    } finally {
      setStatus('');
      release();
    }
  }

  async function flash() {
    const chosen = port.current;
    if ((!toolchain && !local) || !chosen || !hardwareConfirmed) return;
    const release = operation.acquire();
    if (!release) return;
    setFlashError('');
    setFlashStatus('Đang biên dịch firmware D1…');
    try {
      const config = validateD1Config({ mode, first: pins[0], second: pins[1] });
      const segments = toolchain ? await compileD1InBrowser(toolchain, config, setFlashStatus) : await compileWithBridge(config);
      if (port.current !== chosen) throw new Error('D1 đã ngắt USB. Hãy chọn lại COM trước khi nạp.');
      if (chosen === usbPort.port) await usbPort.releaseForFlash();
      setMac(undefined);
      setResetDone(false);
      setFlashStatus('Đang kiểm tra ESP32 D1 và phân vùng flash…');
      await flashD1Firmware(chosen, segments, () => {}, (_part, written, total) => {
        setFlashStatus(written === total ? 'Đang hoàn tất ghi hoặc xác minh firmware D1…' : 'Đang ghi firmware D1 qua USB…');
      });
      setFlashStatus('Đã nạp và xác minh firmware. Nhấn EN/RESET trên D1, rồi bấm Đọc lại MAC.');
    } catch (failure) {
      setFlashStatus('');
      setFlashError(formatSerialError(failure));
    } finally {
      release();
    }
  }

  const macText = mac === 'NONE' ? 'Chưa lưu' : mac === 'INVALID' ? 'Dữ liệu đã lưu bị lỗi' : mac;

  return (
    <>
      <p>Cắm USB vào <strong>ESP32 D1 cầu PS4</strong> rồi chọn COM của D1.</p>
      {label && <p><strong>Cổng D1</strong> · {label}<br /><strong>MAC tay cầm đã lưu</strong> · {macText ? <code>{macText}</code> : '—'}</p>}
      {mac && !resetDone && <p>Nếu đổi tay cầm, hãy tắt tay cầm cũ trước khi reset.</p>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {resetDone && (
        <div role="status">
          <p><strong>Đã xóa MAC tay cầm trên D1.</strong></p>
          <ol>
            <li>Tắt các tay cầm PS4 khác ở gần.</li>
            <li>Giữ <strong>SHARE + PS</strong> trên tay cầm cần ghép cho đến khi đèn nháy nhanh.</li>
            <li>Khi tay cầm kết nối, nhấn một nút để D1 nhận dữ liệu và lưu MAC. Bấm <strong>Đọc lại MAC</strong> để kiểm tra.</li>
          </ol>
        </div>
      )}
      <div className="dialog-actions ps4-mac-actions">
        <button className="btn" disabled={operation.busy} onClick={() => run('choose')}>{label ? 'Đổi COM' : 'Chọn COM'}</button>
        {label && <button className="btn" disabled={operation.busy} onClick={() => run('read')}>Đọc lại MAC</button>}
        {mac && !resetDone && <button className="btn p" disabled={operation.busy} onClick={() => run('reset')}>Reset MAC</button>}
        <button className="btn" disabled={operation.busy} onClick={onClose}>Đóng</button>
      </div>
      <details className="d1-firmware">
        <summary>Nạp firmware D1 · Nâng cao</summary>
        <p><strong>Chức năng nâng cao.</strong> Chỉ dùng khi bạn hiểu cách nạp firmware và kiểm tra được chân dây. Nạp sẽ thay chương trình hiện tại trên D1.</p>
        <fieldset disabled={operation.busy}>
          <legend>Cấu hình ESP32 D1</legend>
          <label className="d1-toolchain">Gói biên dịch D1 (.tar.gz)<input type="file" accept=".gz" onChange={(event) => {
            setToolchain(event.target.files[0] || null); setHardwareConfirmed(false); setFlashStatus(''); setFlashError('');
          }} /></label>
          <p>Chọn gói Bluepad32 4.1.0 tin cậy để biên dịch ngay trong trình duyệt. Tệp được đọc trên máy của bạn.</p>
          <div className="d1-pin-fields">
            <label>Giao tiếp<select value={mode} onChange={(event) => {
              const next = event.target.value;
              setMode(next); setPins(D1_DEFAULT_PINS[next]); setHardwareConfirmed(false);
            }}><option value="i2c">I²C</option><option value="uart">UART</option></select></label>
            {(mode === 'i2c' ? ['SDA', 'SCL'] : ['TX', 'RX']).map((name, index) => (
              <label key={name}>{name} trên D1<select value={pins[index]} onChange={(event) => {
                setPins(pins.map((pin, i) => i === index ? Number(event.target.value) : pin)); setHardwareConfirmed(false);
              }}>{D1_PINS.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select></label>
            ))}
          </div>
          <label className="d1-confirm"><input type="checkbox" checked={hardwareConfirmed} onChange={(event) => setHardwareConfirmed(event.target.checked)} /> Tôi đã chọn đúng COM, kiểm tra dây và ngắt nguồn motor/servo.</label>
          <button type="button" className="btn p" disabled={(!toolchain && !local) || !label || !hardwareConfirmed || pins[0] === pins[1]} onClick={flash}>Biên dịch và nạp firmware D1</button>
        </fieldset>
        {flashStatus && <p role="status">{flashStatus}</p>}
        {flashError && <p role="alert" className="d1-flash-error">{flashError}</p>}
      </details>
    </>
  );
}

async function compileWithBridge(config) {
  const response = await fetch('/api/d1/compile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
  }).catch(() => { throw new Error('Hãy chọn gói biên dịch D1 hoặc khởi động Arduino Bridge cục bộ.'); });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.segments) throw new Error(payload?.error || 'Hãy chọn gói biên dịch D1 hoặc khởi động Arduino Bridge cục bộ.');
  return payload.segments.map(({ address, base64 }) => ({ address, data: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) }));
}
