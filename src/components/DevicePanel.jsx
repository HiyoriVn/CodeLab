import { useEffect, useState } from 'react';
import { getBoardProfile, FAST4WD_BOARD_ID } from '../boards/profiles.js';
import { useDeviceOperation } from '../device/useDeviceOperation.js';
import { isBrowserCompilerEnabled, isDevEnvironment } from '../compiler/config.js';
import { compileInBrowser } from '../compiler/browser-compiler-client.js';
import { flashPackage } from '../device/browser-flash.js';
import { formatSerialError } from '../device/usb-port.js';
import { downloadDebugArtifact } from '../compiler/debug-artifacts.js';

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error([data.error, data.detail, data.output].filter(Boolean).join('\n') || 'Yêu cầu thất bại.');
  return data;
}

function DevicePanel({ code, warnings, boardId, onOpenSerial, operation, usbPort, compileCache }) {
  const localOperation = useDeviceOperation();
  const deviceOperation = operation ?? localOperation;
  const board = getBoardProfile(boardId);
  const localBridge = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const devUi = localBridge || isDevEnvironment();
  const fast4wd = board.capabilities.fast4wd;
  const wasmEnabled = isBrowserCompilerEnabled() && fast4wd;
  const supported = typeof window !== 'undefined' && window.isSecureContext && !!navigator.serial;

  const [status, setStatus] = useState(null);
  const [ports, setPorts] = useState([]);
  const [port, setPort] = useState('');
  const [localCompileState, setLocalCompileState] = useState('Chưa biên dịch');
  const [uploadState, setUploadState] = useState('Chưa kết nối USB');
  const [localBuild, setLocalBuild] = useState(null);
  const build = wasmEnabled && compileCache ? compileCache.effectiveBuild : localBuild;
  const buildId = build?.code === code && build?.boardId === boardId ? build.id : '';
  const compilingWasm = wasmEnabled && compileCache?.state?.status === 'compiling' && compileCache?.state?.cacheKey === compileCache?.activeCacheKey;
  const compileState = wasmEnabled && compileCache
    ? (compilingWasm ? 'Đang biên dịch' : buildId ? 'Thành công' : compileCache.state?.status === 'error' && compileCache.state?.cacheKey === compileCache.activeCacheKey ? 'Thất bại' : 'Chưa biên dịch')
    : localCompileState;
  const busy = deviceOperation.busy;
  const [message, setMessage] = useState('');

  const refresh = async () => {
    if (!localBridge) {
      return;
    }
    const release = deviceOperation.acquire();
    if (!release) return;
    try {
      const [nextStatus, nextPorts] = await Promise.all([
        request('/api/status'),
        request('/api/ports'),
      ]);
      setStatus(nextStatus);
      const eligiblePorts = (nextPorts.ports || []).filter(item => !fast4wd || item.fast4wdCompatible);
      setPorts(eligiblePorts);
      setPort(current => eligiblePorts.some(item => item.address === current) ? current : '');
      setMessage(nextStatus.ready || wasmEnabled ? '' : 'Chưa kết nối được công cụ phát triển.');
    } catch {
      setStatus(null);
      setPorts([]);
      setPort('');
      setMessage(wasmEnabled ? '' : 'Chưa kết nối được công cụ phát triển.');
    } finally {
      release();
    }
  };

  useEffect(() => { refresh(); }, []);

  const compile = async () => {
    if (!code || warnings.length) return;
    if (!wasmEnabled && !status?.ready) return;
    if (wasmEnabled && compileCache?.onCompile) {
      setMessage('');
      await compileCache.onCompile();
      return;
    }
    const release = deviceOperation.acquire();
    if (!release) return;
    setLocalCompileState('Đang biên dịch');
    setMessage('');
    setLocalBuild(null);
    try {
      if (wasmEnabled) {
        const result = await compileInBrowser(code, boardId, {
          onProgress: (p) => setMessage(p),
        });
        if (!result.buildId || result.boardId !== boardId) throw Error('Bản biên dịch không phù hợp.');
        setLocalBuild({ id: result.buildId, code, boardId, package: result });
        setLocalCompileState('Thành công');
        setMessage(`Biên dịch thành công trong trình duyệt (${result.stats.totalMs} ms). Sẵn sàng nạp.`);
      } else {
        const result = await request('/api/compile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, warnings, boardId }),
        });
        if (!result.buildId || result.boardId !== boardId) throw Error('Bản biên dịch không phù hợp.');
        setLocalBuild({ id: result.buildId, code, boardId });
        setLocalCompileState('Thành công');
      }
    } catch (error) {
      setLocalCompileState('Thất bại');
      setMessage('Không thể biên dịch chương trình. Hãy kiểm tra các khối và thử lại.');
    } finally {
      release();
    }
  };

  const uploadFromBrowser = async ({ forceNewPort = false } = {}) => {
    if (deviceOperation.isBusy() || !buildId || !build?.package?.segments || boardId !== FAST4WD_BOARD_ID) return;
    const release = deviceOperation.acquire();
    if (!release) return;
    setUploadState('Đang nạp');
    setMessage(!forceNewPort && usbPort?.port ? `Đang dùng ${usbPort.portLabel}…` : 'Đang chọn USB…');
    try {
      await usbPort?.releaseForFlash?.();
      const selectedPort = usbPort ? await usbPort.selectPort({ forceNew: forceNewPort }) : await navigator.serial.requestPort();
      if (!window.confirm('Nạp chương trình sẽ thay thế chương trình hiện tại. Hãy ngắt nguồn động cơ và đảm bảo robot ở trạng thái an toàn trước khi tiếp tục.')) {
        setMessage('Đã hủy nạp.');
        setUploadState('Chưa nạp');
        return;
      }
      const log = (text) => setMessage((m) => (m + '\n' + text).slice(-6000));
      const progressCb = (_, written, total) => {
        const percent = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
        setUploadState(`Đang nạp ${percent}%`);
      };
      await flashPackage(selectedPort, build.package.segments, log, progressCb);
      setUploadState('Hoàn tất');
      setMessage('Nạp chương trình thành công!');
    } catch (error) {
      setUploadState('Thất bại');
      setMessage(error.name === 'NotFoundError' ? 'Đã hủy chọn USB.' : `Nạp thất bại: ${formatSerialError(error)}`);
    } finally {
      release();
    }
  };

  const upload = async () => {
    if (deviceOperation.isBusy() || !buildId || !port || warnings.length) return;
    if (!window.confirm('Nạp chương trình sẽ thay thế chương trình hiện tại. Hãy ngắt nguồn động cơ và đảm bảo robot ở trạng thái an toàn trước khi tiếp tục.')) return;
    const release = deviceOperation.acquire();
    if (!release) return;
    setUploadState('Đang nạp');
    setMessage('');
    try {
      await request('/api/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buildId, port, boardId, code, warnings, confirmed: true, hardwareConfirmed: true }),
      });
      setUploadState('Hoàn tất');
    } catch (error) {
      setUploadState('Thất bại');
      setMessage('Không thể nạp chương trình. Hãy kiểm tra cáp USB, đóng ứng dụng đang dùng cổng và thử lại.');
    } finally {
      release();
    }
  };

  return (
    <section className="device-panel" aria-label="Biên dịch và nạp ESP32-S3">
      <div className="device-panel-heading">
        <div><span className="code-panel-icon" aria-hidden="true">↥</span><strong>Newmania ESP32S3 Board</strong></div>
      </div>
      <section className="device-step" aria-labelledby="compile-step">
        <h4 id="compile-step">Bước 1 — Biên dịch chương trình</h4>
        <p role="status">{build && !buildId ? 'Chưa biên dịch — chương trình đã thay đổi.' : compileState}</p>
        {!localBridge && !wasmEnabled && <p id="compiler-unavailable">Chức năng biên dịch trên website đang được phát triển.</p>}
        <button
          className="button button-primary"
          onClick={compile}
          aria-describedby={!localBridge && !wasmEnabled ? 'compiler-unavailable' : undefined}
          disabled={(!localBridge && !wasmEnabled) || busy || compilingWasm || (!wasmEnabled && !status?.ready) || !code || warnings.length > 0}
        >
          {compilingWasm ? 'Đang biên dịch…' : 'Biên dịch chương trình'}
        </button>
      </section>
      <section className="device-step" aria-labelledby="upload-step">
        <h4 id="upload-step">Bước 2 — Nạp chương trình</h4>
        <p role="status">{uploadState}</p>
        <div className="device-actions">
          <button
            className="button button-primary"
            onClick={() => uploadFromBrowser({ forceNewPort: false })}
            disabled={!wasmEnabled || !buildId || !build?.package || busy || !supported}
            aria-describedby={!wasmEnabled ? 'upload-unavailable' : undefined}
          >
            {usbPort?.port ? `Nạp qua ${usbPort.portLabel}` : 'Chọn USB và nạp'}
          </button>
          {usbPort?.port && (
            <button
              className="button button-quiet"
              onClick={() => uploadFromBrowser({ forceNewPort: true })}
              disabled={!wasmEnabled || !buildId || !build?.package || busy || !supported}
            >
              Đổi USB
            </button>
          )}
        </div>
        {!wasmEnabled && (
          <p id="upload-unavailable">
            {!localBridge ? 'Hãy chờ chức năng biên dịch trên website hoàn thiện.' : 'Chức năng nạp từ Blockly qua trình duyệt đang được phát triển.'}
          </p>
        )}
      </section>
      {(message || (wasmEnabled && compileCache?.state?.cacheKey === compileCache?.activeCacheKey && compileCache?.state?.message)) && (
        <p className="device-message" role="alert">{message || compileCache.state.message}</p>
      )}
      {warnings.length > 0 && <p role="alert">Chương trình còn khối cần sửa. Hãy kiểm tra phần Code.</p>}
      {devUi && build?.package?.debug && <details className="device-technical">
        <summary>Debug firmware</summary>
        <p>{build.id}</p>
        <button className="button button-quiet" disabled={busy || !buildId} onClick={() => downloadDebugArtifact(build.package, 'elf')}>Tải app.elf</button>
        <button className="button button-quiet" disabled={busy || !buildId} onClick={() => downloadDebugArtifact(build.package, 'json')}>Tải thông tin debug</button>
      </details>}
      {localBridge && <details className="device-technical">
        <summary>Công cụ phát triển local</summary>
        <div className="device-actions">
        <button className="button button-quiet" onClick={refresh} disabled={busy}>Làm mới cổng</button>
        <label>Cổng thiết bị
          <select value={port} onChange={(event) => { setPort(event.target.value); setUploadState('Chưa nạp'); }} disabled={busy || !ports.length}>
            <option value="">{ports.length ? 'Chọn cổng thiết bị…' : 'Chưa tìm thấy cổng'}</option>
            {ports.map((item) => <option key={item.address} value={item.address}>{item.address === item.label ? item.address : `${item.address} — ${item.label}`}</option>)}
          </select>
        </label>
        <button className="button button-quiet" onClick={upload} disabled={busy || !buildId || !port || warnings.length > 0}>Nạp qua bridge</button>
        <p role="status">{build && !buildId ? 'Chưa nạp — chương trình đã thay đổi.' : uploadState}</p>
        {uploadState === 'Đang nạp' && <progress aria-label="Đang nạp qua bridge" />}
        <button className="button button-quiet" onClick={onOpenSerial} disabled={busy}>Mở Bảng lệnh</button>
        </div>
      </details>}
    </section>
  );
}

export default DevicePanel;
