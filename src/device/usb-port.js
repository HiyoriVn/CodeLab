import { useCallback, useEffect, useRef, useState } from 'react';

export function formatSerialError(error) {
  const message = String(error?.message || error || '');
  const name = String(error?.name || '');
  const lower = message.toLowerCase();
  if (
    name === 'NetworkError' ||
    lower.includes('failed to open serial port') ||
    lower.includes('already open') ||
    lower.includes('access denied') ||
    lower.includes('in use') ||
    lower.includes('busy') ||
    lower.includes('permission denied')
  ) {
    return 'Cổng COM đang bị phần mềm khác chiếm (ví dụ: Arduino IDE hoặc Serial Monitor khác). Hãy đóng phần mềm đó rồi thử lại.';
  }
  return message || 'Lỗi kết nối cổng USB.';
}

export function describeSerialPort(port) {
  if (!port) return '';
  try {
    const info = port.getInfo?.();
    if (info?.usbVendorId && info?.usbProductId) {
      const vid = info.usbVendorId.toString(16).padStart(4, '0').toUpperCase();
      const pid = info.usbProductId.toString(16).padStart(4, '0').toUpperCase();
      return `USB ${vid}:${pid}`;
    }
  } catch {}
  return 'USB đã chọn';
}

export function useSharedUsbPort() {
  const portRef = useRef(null);
  const serialCloserRef = useRef(null);
  const [port, setPort] = useState(null);

  useEffect(() => {
    const serial = typeof navigator !== 'undefined' ? navigator.serial : undefined;
    if (!serial?.addEventListener) return undefined;
    const onDisconnect = (event) => {
      if (event?.target && event.target === portRef.current) {
        portRef.current = null;
        setPort(null);
      }
    };
    serial.addEventListener('disconnect', onDisconnect);
    return () => serial.removeEventListener('disconnect', onDisconnect);
  }, []);

  const selectPort = useCallback(async ({ forceNew = false } = {}) => {
    if (!forceNew && portRef.current) return portRef.current;
    if (typeof navigator === 'undefined' || !navigator.serial) {
      throw new Error('Trình duyệt này chưa hỗ trợ Web Serial. Hãy dùng Chrome hoặc Edge trên máy tính.');
    }
    const chosen = await navigator.serial.requestPort();
    if (portRef.current && portRef.current !== chosen && serialCloserRef.current) {
      await serialCloserRef.current();
    }
    portRef.current = chosen;
    setPort(chosen);
    return chosen;
  }, []);

  const clearPort = useCallback(() => {
    portRef.current = null;
    setPort(null);
  }, []);

  const registerSerialCloser = useCallback((fn) => {
    serialCloserRef.current = fn;
  }, []);

  const releaseForFlash = useCallback(async () => {
    if (serialCloserRef.current) {
      await serialCloserRef.current();
    }
  }, []);

  return {
    port,
    portLabel: describeSerialPort(port),
    selectPort,
    clearPort,
    registerSerialCloser,
    releaseForFlash,
  };
}
