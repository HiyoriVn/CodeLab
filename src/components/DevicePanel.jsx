import { useEffect, useState } from 'react';
import { getBoardProfile } from '../boards/profiles.js';

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error([data.error, data.detail, data.output].filter(Boolean).join('\n') || 'Yêu cầu thất bại.');
  return data;
}

function DevicePanel({ code, warnings, boardId, onOpenSerial }) {
  const board = getBoardProfile(boardId);
  const fast4wd = board.capabilities.fast4wd;
  const [status, setStatus] = useState(null);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState('');
  const [hardwareConfirmed, setHardwareConfirmed] = useState(false);
  const [build, setBuild] = useState(null);
  const buildId = build?.code === code && build?.boardId === boardId ? build.id : '';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Đang kết nối dịch vụ Arduino cục bộ…');

  const refresh = async () => {
    setHardwareConfirmed(false);
    try {
      const [nextStatus, nextPorts] = await Promise.all([
        request('/api/status'),
        request('/api/ports'),
      ]);
      setStatus(nextStatus);
      const eligiblePorts = (nextPorts.ports || []).filter(item => !fast4wd || item.fast4wdCompatible);
      setPorts(eligiblePorts);
      setPort(current => eligiblePorts.some(item => item.address === current) ? current : '');
      setMessage(nextStatus.ready ? 'Arduino CLI đã sẵn sàng.' : (nextStatus.error || 'Chưa tìm thấy Arduino CLI.'));
    } catch {
      setStatus(null);
      setPorts([]);
      setPort('');
      setMessage('Chưa kết nối bridge. Chạy npm run bridge và cài Arduino CLI cùng ESP32 core.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const compile = async () => {
    setBusy(true);
    setMessage('Đang biên dịch cho ESP32-S3…');
    setBuild(null);
    try {
      const result = await request('/api/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, warnings, boardId }),
      });
      setBuild({ id: result.buildId, code, boardId });
      setMessage('Biên dịch thành công. Chọn cổng rồi xác nhận nạp khi sẵn sàng.\n' + (result.output || ''));
    } catch (error) {
      setMessage('Biên dịch thất bại. Xem lỗi Arduino CLI bên dưới.\n' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!buildId || !port || warnings.length || (fast4wd && !hardwareConfirmed)) return;
    if (!window.confirm(`Nạp firmware ${board.name} vào ${port}? Chương trình đang chạy trên bo sẽ bị thay thế.`)) return;
    setBusy(true);
    setMessage('Đang nạp firmware… Không rút cáp USB.');
    try {
      const result = await request('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buildId, port, boardId, code, warnings, confirmed: true, hardwareConfirmed }),
      });
      setMessage(['Nạp xong. Mở Bảng lệnh để xem Serial 115200.', result.output, result.error].filter(Boolean).join('\n'));
    } catch (error) {
      setMessage('Nạp thất bại. Nếu cổng đang bận, đóng Serial Monitor rồi thử lại.\n' + error.message);
    } finally {
      setHardwareConfirmed(false);
      setBusy(false);
    }
  };

  return (
    <section className="device-panel" aria-label="Biên dịch và nạp ESP32-S3">
      <div className="device-panel-heading">
        <div><span className="code-panel-icon" aria-hidden="true">↥</span><strong>{board.name}</strong><small>{board.build.fqbn}</small></div>
        <button className="button button-quiet" onClick={refresh} disabled={busy}>Làm mới cổng</button>
      </div>
      <p className="device-message" style={{ whiteSpace: 'pre-wrap' }} role="status">{message}</p>
      {warnings.length > 0 && <div role="alert" className="beginner-help"><strong>Chưa thể biên dịch. Hãy sửa các mục sau:</strong><ul>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
      {fast4wd && <div className="beginner-help">
        <p>Chỉ dùng bo ESP32-S3 fast100 đã xác minh, flash 16 MB. GPIO35–37 phải rảnh; bo N16R8/Octal không đủ điều kiện. Chọn cổng USB gốc của S3 sau khi đối chiếu bằng cách rút và cắm lại cáp S3.</p>
        <label><input type="checkbox" checked={hardwareConfirmed} disabled={busy || !port}
          onChange={(event) => setHardwareConfirmed(event.target.checked)} />
          Tôi xác nhận đúng bo fast100, GPIO35–37 không nối bộ nhớ và nguồn động cơ đã ngắt.
        </label>
      </div>}
      <div className="device-actions">
        <label>Cổng thiết bị
          <select value={port} onChange={(event) => { setPort(event.target.value); setHardwareConfirmed(false); }} disabled={busy || !ports.length}>
            <option value="">{ports.length ? 'Chọn cổng thiết bị…' : 'Chưa tìm thấy cổng'}</option>
            {ports.map((item) => <option key={item.address} value={item.address}>{item.address === item.label ? item.address : `${item.address} — ${item.label}`}</option>)}
          </select>
        </label>
        <button className="button button-primary" onClick={compile} disabled={busy || !status?.ready || !code || warnings.length > 0}>Biên dịch</button>
        <button className="button button-quiet" onClick={upload} disabled={busy || !buildId || !port || warnings.length > 0 || (fast4wd && !hardwareConfirmed)}>Nạp lên bo mạch…</button>
        <button className="button button-quiet" onClick={onOpenSerial} disabled={busy}>Mở Bảng lệnh</button>
      </div>
      <small className="device-note">CodeLab đóng Bảng lệnh khi mở cửa sổ này. Đóng Arduino IDE Serial Monitor hoặc ứng dụng khác đang giữ cổng trước khi nạp.</small>
    </section>
  );
}

export default DevicePanel;
