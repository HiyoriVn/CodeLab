import { getBoardProfile, DEFAULT_BOARD_ID } from '../boards/profiles.js';
export function roboticsToolbox(boardId) {
  const p=getBoardProfile(boardId);
  const types=['codelab_delay_ms','codelab_gpio_write','codelab_gpio_read','codelab_gpio_read_mode'];
  if(p.capabilities.adc) types.push('codelab_analog_read');
  if(p.capabilities.pwm) types.push('codelab_pwm_write');
  if(p.id===DEFAULT_BOARD_ID) types.push('codelab_hbridge_motor');
  else {
    if(p.capabilities.motorChannels>0) types.push('codelab_motor_channel');
    if(p.capabilities.servoChannels>0) types.push('codelab_servo_write','codelab_servo_disable');
  }
  types.push('codelab_serial_print','codelab_serial_available','codelab_serial_read');
  return types.map(type=>({kind:'block',type,...(type==='codelab_pwm_write'?{inputs:{DUTY:{shadow:{type:'math_number',fields:{NUM:0}}}}}:{})}));
}
