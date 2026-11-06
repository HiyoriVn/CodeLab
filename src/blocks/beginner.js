import * as Blockly from 'blockly';
import { getBoardProfile } from '../boards/profiles.js';

// New IDs only. Existing blocks and their serialized fields remain unchanged.
const statement = (message0, args0 = [], colour = '#e79b23', extra = {}) => ({message0,args0,previousStatement:null,nextStatement:null,colour,...extra});
const dropdown = (name, options) => ({type:'field_dropdown',name,options});
const number = (name,value,min,max) => ({type:'field_number',name,value,min,max});
Blockly.defineBlocksWithJsonArray([
  {type:'beginner_start',message0:'Khi bắt đầu chương trình %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],colour:'#e79b23',tooltip:'Chạy một lần khi mạch khởi động. Ví dụ: hiện lời chào.'},
  {type:'beginner_forever',message0:'Lặp lại mãi mãi %1 %2',args0:[{type:'input_dummy'},{type:'input_statement',name:'DO'}],colour:'#e79b23',tooltip:'Mạch lặp lại các lệnh bên trong. Ví dụ: bật đèn rồi tắt đèn.'},
  {type:'beginner_wait',...statement('Đợi %1 giây',[number('SECONDS',1,0,60)]),tooltip:'Đợi 1 giây giống như đếm một nhịp.'},
  {type:'beginner_led',...statement('%1 đèn trên mạch',[dropdown('STATE',[['Bật','HIGH'],['Tắt','LOW']])],'#9664d6'),tooltip:'Dùng đèn có sẵn trên board, không cần nhập GPIO.'},
  {type:'beginner_blink',...statement('Nhấp nháy đèn mỗi %1 giây',[number('SECONDS',0.5,0.01,60)],'#9664d6'),tooltip:'Bật rồi tắt đèn. Mỗi trạng thái kéo dài số giây đã chọn.'},
  {type:'beginner_message',...statement('Hiện lời nhắn %1',[{type:'input_value',name:'VALUE'}],'#9664d6'),tooltip:'Xem lời nhắn trong Bảng lệnh ở 115200 baud. Có thể gắn chữ hoặc số.'},
  {type:'beginner_serial_ready',message0:'Có dữ liệu gửi tới mạch?',output:'Boolean',colour:'#45a4ad',tooltip:'Đúng khi có chữ đang chờ đọc từ Bảng lệnh. Không cần nối cảm biến ngoài.'},
  {type:'beginner_ps4_setup',...statement('Nhận tay PS4 qua cổng UART của board',[],'#cf5b9b'),tooltip:'Dùng ESP32 bridge riêng và dây UART đúng profile. Không kết nối Bluetooth trực tiếp trên S3.'},
  {type:'beginner_ps4_sim',...statement('Mô phỏng PS4: kết nối %1 cần ngang %2 nút X %3',[{type:'field_checkbox',name:'CONNECTED',checked:true},number('LX',0,-1000,1000),{type:'field_checkbox',name:'PRESSED',checked:false}],'#cf5b9b'),tooltip:'Dữ liệu giả lập để học điều kiện; không đọc tay cầm thật và không chạy motor.'},
  {type:'beginner_ps4_connected',message0:'Tay PS4 đã kết nối?',output:'Boolean',colour:'#cf5b9b',tooltip:'Dùng cùng khối Nhận tay PS4 hoặc Mô phỏng PS4.'},
  {type:'beginner_ps4_button',message0:'Nút %1 PS4 được nhấn?',args0:[dropdown('BUTTON',[['X','CROSS'],['Tròn','CIRCLE'],['Vuông','SQUARE'],['Tam giác','TRIANGLE'],['Lên','UP'],['Xuống','DOWN']])],output:'Boolean',colour:'#cf5b9b',tooltip:'Đúng khi nút được nhấn. Mô phỏng chỉ hỗ trợ nút X.'},
  {type:'beginner_ps4_axis',message0:'Cần trái %1',args0:[dropdown('AXIS',[['ngang','LX'],['dọc','LY']])],output:'Number',colour:'#cf5b9b',tooltip:'Từ −1000 đến 1000, giữa là 0. Mô phỏng chỉ thay đổi cần ngang.'},
  {type:'beginner_motor',...statement('Động cơ %1 quay %2 tốc độ %3 %',[dropdown('CHANNEL',Array.from({length:6},(_,i)=>['M'+(i+1),String(i+1)])),dropdown('DIRECTION',[['tiến','FORWARD'],['lùi','REVERSE']]),number('SPEED',20,0,100)],'#4c97ff'),tooltip:'Chưa có backend motor được nghiệm thu. Khối này chặn biên dịch để bảo vệ mạch.'},
  {type:'beginner_motor_stop',...statement('Dừng động cơ %1',[dropdown('CHANNEL',Array.from({length:6},(_,i)=>['M'+(i+1),String(i+1)]))],'#4c97ff'),tooltip:'Cần backend motor được nghiệm thu để phát lệnh dừng thật.'},
  {type:'beginner_servo',...statement('Servo %1 quay đến %2 độ',[dropdown('CHANNEL',Array.from({length:6},(_,i)=>['S'+(i+1),String(i+1)])),number('ANGLE',90,0,180)],'#4c97ff'),tooltip:'Chưa thể bật servo: cần xác minh chân, nguồn và backend an toàn.'},
]);

// Keep every stored option valid on import; mark unavailable channels instead of remapping.
for (const type of ['beginner_motor','beginner_motor_stop','beginner_servo']) {
  const original = Blockly.Blocks[type].init;
  Blockly.Blocks[type].init = function() {
    original.call(this);
    const servo = type === 'beginner_servo';
    this.getField('CHANNEL').setOptions(function() {
      const p = getBoardProfile(this.getSourceBlock()?.workspace.codelabBoardId);
      const count = p.capabilities[servo ? 'servoChannels' : 'motorChannels'] || 0;
      return Array.from({length:6},(_,i)=>[(servo?'S':'M')+(i+1)+(i<count?'':' (không có trên board)'),String(i+1)]);
    });
  };
}
