import { useEffect, useState } from 'react';

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
  return data;
}

function DevicePanel({ code, warnings }) {
  const [status, setStatus] = useState(null);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState('');
  const [buildId, setBuildId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Đang kết nối dịch vụ Arduino cục bộ…');

  const refresh = async () => {
    try {
      const [nextStatus, nextPorts] = await Promise.all([
        request('/api/status'),
        request('/api/ports'),
      ]);
      setStatus(nextStatus);
      setPorts(nextPorts.ports || []);
      setPort((current) => current || nextPorts.ports?.[0]?.address || '');
      setMessage(nextStatus.ready ? 'Arduino CLI đã sẵn sàng.' : (nextStatus.error || 'Chưa tìm thấy Arduino CLI.'));
    } catch {
      setStatus(null);
      setMessage('Chưa kết nối bridge. Chạy npm run bridge và cài Arduino CLI cùng ESP32 core.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const compile = async () => {
    setBusy(true);
    setMessage('Đang biên dịch cho ESP32-S3…');
    setBuildId('');
    try {
      const result = await request('/api/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, warnings }),
      });
      setBuildId(result.buildId);
      setMessage('Biên dịch thành công. Chọn cổng rồi xác nhận nạp khi sẵn sàng.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!buildId || !port) return;
    if (!window.confirm(`Nạp firmware ESP32-S3 vào ${port}? Chương trình đang chạy trên bo sẽ bị thay thế.`)) return;
    setBusy(true);
    setMessage('Đang nạp firmware… Không rút cáp USB.');
    try {
      await request('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buildId, port, confirmed: true }),
      });
      setMessage('Nạp xong. Nhấn RESET trên bo mạch nếu chương trình chưa tự chạy.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="device-panel" aria-label="Biên dịch và nạp ESP32-S3">
      <div className="device-panel-heading">
        <div><span className="code-panel-icon" aria-hidden="true">↥</span><strong>ESP32-S3</strong><small>{status?.fqbn || 'Arduino CLI cục bộ'}</small></div>
        <button className="button button-quiet" onClick={refresh} disabled={busy}>Làm mới cổng</button>
      </div>
      <p className="device-message" role="status">{message}</p>
      <div className="device-actions">
        <label>Cổng thiết bị
          <select value={port} onChange={(event) => setPort(event.target.value)} disabled={busy || !ports.length}>
            {!ports.length && <option value="">Chưa tìm thấy cổng</option>}
            {ports.map((item) => <option key={item.address} value={item.address}>{item.label}</option>)}
          </select>
        </label>
        <button className="button button-primary" onClick={compile} disabled={busy || !status?.ready || !code || warnings.length > 0}>Biên dịch</button>
        <button className="button button-quiet" onClick={upload} disabled={busy || !buildId || !port}>Nạp lên bo mạch…</button>
      </div>
      <small className="device-note">Nạp sẽ thay chương trình trên bo. Kiểm tra dây, tải ngoài và nguồn động cơ trước khi chạy.</small>
    </section>
  );
}

export default DevicePanel;
