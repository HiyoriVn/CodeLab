export const INK = '#1F2340';

export const CATEGORIES = {
  control:   { name: 'Bắt đầu & Điều khiển', colour: '#7ECBB1' },
  math:      { name: 'Toán học',             colour: '#9ECB8E' },
  logic:     { name: 'Logic',                colour: '#8DB5E6' },
  variable:  { name: 'Biến',                 colour: '#EDB070' },
  procedure: { name: 'Hàm',                  colour: '#EE9BB0' },
  led:       { name: 'Đèn',                  colour: '#EBC96F' },
  display:   { name: 'Hiển thị',             colour: '#C4A3D8' },
  sensor:    { name: 'Cảm biến',             colour: '#7CC4DA' },
  ps4:       { name: 'Tay cầm PS4 (mô phỏng)', colour: '#D9A0D3' },
  advanced:  { name: 'Nâng cao',             colour: '#A8B6C8' },
};

export const BLOCK_CATEGORY = {
  control: ['beginner_start', 'beginner_forever', 'beginner_wait', 'codelab_delay_ms',
    'controls_if', 'controls_if_if', 'controls_if_elseif', 'controls_if_else',
    'controls_repeat_ext', 'controls_repeat', 'controls_whileUntil', 'controls_for', 'controls_forEach', 'controls_flow_statements'],
  math: ['math_number', 'math_arithmetic', 'math_modulo', 'math_single', 'math_random_int', 'math_round', 'math_constrain',
    'math_trig', 'math_constant', 'math_number_property', 'math_on_list', 'math_random_float'],
  logic: ['logic_compare', 'logic_operation', 'logic_boolean', 'logic_negate', 'logic_null', 'logic_ternary'],
  variable: ['variables_get', 'variables_set', 'math_change', 'variables_get_dynamic', 'variables_set_dynamic'],
  procedure: ['procedures_defnoreturn', 'procedures_defreturn', 'procedures_callnoreturn', 'procedures_callreturn',
    'procedures_ifreturn', 'procedures_mutatorcontainer', 'procedures_mutatorarg'],
  led: ['beginner_led', 'beginner_blink'],
  display: ['beginner_message', 'text', 'text_join', 'text_print', 'text_length', 'text_isEmpty', 'text_append'],
  sensor: ['beginner_serial_ready'],
  ps4: ['beginner_ps4_sim', 'beginner_ps4_connected', 'beginner_ps4_button', 'beginner_ps4_axis', 'beginner_ps4_setup',
    'codelab_ps4_begin_uart', 'codelab_ps4_begin_i2c', 'codelab_ps4_connected', 'codelab_ps4_axis', 'codelab_ps4_button'],
  advanced: ['codelab_gpio_write', 'codelab_gpio_read', 'codelab_gpio_read_mode', 'codelab_analog_read', 'codelab_pwm_write',
    'codelab_hbridge_motor', 'codelab_motor_channel', 'codelab_servo_write', 'codelab_servo_disable',
    'codelab_serial_print', 'codelab_serial_available', 'codelab_serial_read',
    'beginner_motor', 'beginner_motor_stop', 'beginner_servo'],
};

export const styleNameOf = (key) => `cx_${key}`;

const mix = (hex, other, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.substr(i, 2), 16) * (1 - t) + parseInt(other.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('')}`;
const BORDER_DARKEN = 0.34;

const make = (cat, extra = {}) => ({
  colourPrimary: cat.colour,
  colourSecondary: cat.colour,
  colourTertiary: mix(cat.colour, '#000000', BORDER_DARKEN),
  ...extra,
});

export const blockStyles = {
  ...Object.fromEntries(Object.entries(CATEGORIES).map(([key, c]) => [styleNameOf(key), make(c)])),
  [styleNameOf('procedure')]: make(CATEGORIES.procedure, { hat: 'cap' }),
  logic_blocks: make(CATEGORIES.logic),
  loop_blocks: make(CATEGORIES.control),
  math_blocks: make(CATEGORIES.math),
  text_blocks: make(CATEGORIES.display),
  list_blocks: make(CATEGORIES.display),
  colour_blocks: make(CATEGORIES.display),
  variable_blocks: make(CATEGORIES.variable),
  variable_dynamic_blocks: make(CATEGORIES.variable),
  procedure_blocks: make(CATEGORIES.procedure, { hat: 'cap' }),
};

export const categoryStyles = {
  loop_category: { colour: CATEGORIES.control.colour },
  logic_category: { colour: CATEGORIES.logic.colour },
  math_category: { colour: CATEGORIES.math.colour },
  text_category: { colour: CATEGORIES.display.colour },
  variable_category: { colour: CATEGORIES.variable.colour },
  procedure_category: { colour: CATEGORIES.procedure.colour },
};
