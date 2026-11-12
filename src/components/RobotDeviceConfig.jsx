import { useState } from 'react';
import { defaultRobotDevices, robotDeviceWarnings, wheelNames } from '../boards/robot-devices.js';

export default function RobotDeviceConfig({ board, devices, onSave }) {
  const [draft, setDraft] = useState(() => devices ?? defaultRobotDevices(board));
  const warnings = robotDeviceWarnings(draft, board);
  const physical = board.capabilities.fast4wd;
  const editMotor = (id, change) => setDraft(current => ({
    ...current, motors: current.motors.map(motor => motor.id === id ? { ...motor, ...change } : motor),
  }));
  const editDrive = change => setDraft(current => ({ ...current, drivetrain: { ...current.drivetrain, ...change } }));
  const editController = change => setDraft(current => ({ ...current, controller: { ...current.controller, ...change } }));
  const wheels = draft.drivetrain.wheels;

  if (!draft.motors.length) return <p>Profile này chưa có cổng motor dành cho Cấu hình robot.</p>;
  return <form className="robot-device-config" onSubmit={event => { event.preventDefault(); if (!warnings.length) onSave(draft); }}>
    <p>{board.name} · {physical ? 'PWM có kiểm tra phần cứng; dự án dùng PS4 dừng motor khi mất link.' : 'Cấu hình theo sơ đồ. PWM vật lý chưa được xác minh.'}</p>
    <fieldset>
      <legend>Motor</legend>
      {draft.motors.map((motor, i) => <div className="robot-device-row" key={motor.id}>
        <label>Tên motor {i + 1}<input value={motor.name} maxLength={40} required
          onChange={event => editMotor(motor.id, { name: event.target.value })} /></label>
        <label>Cổng<select value={motor.port} onChange={event => editMotor(motor.id, { port: Number(event.target.value) })}>
          {board.pins.motors.map((pins, index) => <option key={index} value={index + 1}>M{index + 1} ({pins.join('/')})</option>)}
        </select></label>
        <label><input type="checkbox" checked={motor.reversed} onChange={event => editMotor(motor.id, { reversed: event.target.checked })} /> Đảo chiều</label>
        <label><input type="checkbox" checked={motor.enabled} onChange={event => editMotor(motor.id, { enabled: event.target.checked })} /> Bật motor</label>
      </div>)}
    </fieldset>
    <fieldset>
      <legend>Drivetrain mecanum</legend>
      <label><input type="checkbox" checked={wheels.length > 0}
        onChange={event => editDrive({ wheels: event.target.checked ? draft.motors.slice(0, 4).map(motor => motor.id) : [] })} /> Bật drivetrain 4 bánh</label>
      {wheels.map((id, index) => <label key={index}>{wheelNames[index]}
        <select value={id} onChange={event => editDrive({ wheels: wheels.map((value, i) => i === index ? event.target.value : value) })}>
          {draft.motors.map(motor => <option key={motor.id} value={motor.id}>{motor.name} · M{motor.port}{motor.enabled ? '' : ' (tắt)'}</option>)}
        </select>
      </label>)}
      <label>Giới hạn PWM (%)<input type="number" min="1" max="100" required value={draft.drivetrain.limit || ''}
        onChange={event => editDrive({ limit: Number(event.target.value) })} /></label>
    </fieldset>
    {physical && <fieldset>
      <legend>Tay cầm PS4 qua I2C</legend>
      <label><input type="checkbox" checked={draft.controller.enabled}
        onChange={event => editController({ enabled: event.target.checked })} /> Bật PS4 · SDA8 / SCL9 · 0x30</label>
      <label><input type="checkbox" checked={draft.controller.blink}
        onChange={event => editController({ blink: event.target.checked })} /> Báo link trên LED47</label>
    </fieldset>}
    {warnings.length > 0 && <ul role="alert">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    <div className="dialog-actions"><button className="btn p" disabled={warnings.length > 0}>Lưu cấu hình</button></div>
  </form>;
}
