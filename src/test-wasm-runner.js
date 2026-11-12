import * as Blockly from 'blockly';
import { LESSONS, lessonProject } from './lessons/newmania.js';
import legacyProject from '../examples/beginner/lesson_robot_motor_events/lesson_robot_motor_events.codelab.json';
import { generateArduino } from './generators/arduino.js';
import { FAST4WD_BOARD_ID } from './boards/profiles.js';
import { compileInBrowser } from './compiler/browser-compiler-client.js';
import { setBrowserCompilerEnabled } from './compiler/config.js';
import { validatePackage, sha256 } from './device/firmware-package.js';

setBrowserCompilerEnabled(true);

const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');

function log(text) {
  outputEl.textContent += text + '\n';
  console.log(text);
  fetch('/api/test-log', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text,
  }).catch(() => {});
}

async function run() {
  log('Bắt đầu quy trình kiểm thử Blockly -> C++ -> WASM -> BIN...');


  const programs = LESSONS.map(lesson => {
    const project=lessonProject(lesson.id), workspace=new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(project.workspace,workspace);
      const result=generateArduino(workspace,project.boardId,project.deviceConfigs[project.boardId]);
      if(result.warnings.length)throw Error(result.warnings.join('; '));
      return {id:lesson.id,name:lesson.label,code:result.code};
    }finally{workspace.dispose();}
  });
  // A standalone signed motor program deliberately has no PS4 blocks.
  const autonomous=lessonProject('serial_counter'),autoWorkspace=new Blockly.Workspace();
  Blockly.serialization.workspaces.load(autonomous.workspace,autoWorkspace);
  const root=autoWorkspace.getBlocksByType('newmania_design_program')[0];
  const first=root.getInputTargetBlock('DO');first.unplug();
  const spin=autoWorkspace.newBlock('newmania_design_robot_motor_power');
  const power=autoWorkspace.newBlock('math_number');power.setFieldValue(20,'NUM');
  spin.getInput('POWER').connection.connect(power.outputConnection);
  root.getInput('DO').connection.connect(spin.previousConnection);spin.nextConnection.connect(first.previousConnection);
  const autoCode=generateArduino(autoWorkspace,FAST4WD_BOARD_ID);
  if(autoCode.warnings.length)throw Error(autoCode.warnings.join('; '));
  programs.push({id:'autonomous_motor',name:'Motor tự động không PS4',code:autoCode.code});autoWorkspace.dispose();
  const legacy=new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(legacyProject.project.workspace,legacy);
    const result=generateArduino(legacy,FAST4WD_BOARD_ID,legacyProject.project.deviceConfigs[FAST4WD_BOARD_ID]);
    if(result.warnings.length)throw Error(result.warnings.join('; '));
    programs.push({id:'legacy_events',name:'Tương thích sự kiện motor cũ, không ARM/Share',code:result.code});
  }finally{legacy.dispose();}

  const results = [];

  for (const prog of programs) {
    log(`\n--- Đang biên dịch: ${prog.name} ---`);
    const t0 = performance.now();
    const buildRes = await compileInBrowser(prog.code, FAST4WD_BOARD_ID, {
      onProgress: (p) => log(`  [Tiến độ] ${p}`),
    });
    const durationMs = Math.round(performance.now() - t0);

    // Verify buildId is tied to code and boardId
    if (!buildRes.buildId || !buildRes.buildId.startsWith('wasm-') || buildRes.boardId !== FAST4WD_BOARD_ID) {
      throw new Error(`BuildId hoặc BoardId không hợp lệ: ${buildRes.buildId}`);
    }

    // Verify 4 segments
    if (!buildRes.segments || buildRes.segments.length !== 4) {
      throw new Error(`Số lượng segment không đúng: ${buildRes.segments?.length}`);
    }

    // Re-verify package with validatePackage
    const validated = await validatePackage(
      buildRes.manifest,
      buildRes.manifest.segments.map((s, idx) => ({
        name: s.file,
        size: buildRes.segments[idx].data.length,
        arrayBuffer: async () => buildRes.segments[idx].data.buffer,
      })),
      sha256
    );

    log(`  [Hoàn tất] buildId=${buildRes.buildId}`);
    log(`  [Thời gian] Tổng=${durationMs}ms (Compile=${buildRes.stats.compileMs}ms, Link=${buildRes.stats.linkMs}ms)`);
    log(`  [Kích thước] ELF=${buildRes.stats.elfSize}B, AppBin=${buildRes.stats.appBinSize}B`);
    log(`  [validatePackage] PASS (4 segments: 0x0, 0x8000, 0xe000, 0x10000)`);

    results.push({
      id: prog.id,
      name: prog.name,
      status: 'PASS',
      buildId: buildRes.buildId,
      durationMs,
      stats: buildRes.stats,
      libraryRevision: buildRes.libraryRevision,
      segments: buildRes.manifest.segments.map((s) => ({ file: s.file, address: s.address, sha256: s.sha256 })),
    });
  }

  // 5. Test build invalidation when code changes
  log('\n--- Kiểm tra cơ chế chống nạp nhầm firmware (Build Invalidation) ---');
  const modifiedCode = programs[0].code + '\n// modified comment';
  const build1 = results[0].buildId;
  const hash1 = build1.split('-')[1];
  const buildMod = await compileInBrowser(modifiedCode, FAST4WD_BOARD_ID);
  const hashMod = buildMod.buildId.split('-')[1];
  if (hash1 === hashMod) {
    throw new Error('BuildId không thay đổi khi mã C++ thay đổi!');
  }
  log(`  Mã gốc hash=${hash1} -> Mã sửa đổi hash=${hashMod} (BuildId đã thay đổi chính xác, chống nạp nhầm PASS)`);

  // 6. Test Error Handling: C++ Compilation Failure
  log('\n--- Kiểm tra xử lý lỗi khi mã nguồn C++ có lỗi cú pháp ---');
  let compileErrorCaught = false;
  try {
    await compileInBrowser('void setup() { invalid_syntax_error@@; } void loop() {}', FAST4WD_BOARD_ID);
  } catch (err) {
    compileErrorCaught = true;
    log(`  Bắt được lỗi biên dịch đúng như kỳ vọng: ${err.message.split('\n')[0]}`);
  }
  if (!compileErrorCaught) {
    throw new Error('Compiler không ném lỗi khi gặp cú pháp C++ sai!');
  }

  // 7. Test Error Handling: Missing Toolchain Resource / 404
  log('\n--- Kiểm tra xử lý lỗi khi tài nguyên toolchain không tìm thấy hoặc mất kết nối ---');
  let networkErrorCaught = false;
  try {
    const worker = new Worker(new URL('./compiler/browser-compiler.worker.js', import.meta.url), { type: 'module' });
    await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'error') reject(new Error(e.data.message));
        if (e.data.type === 'done') resolve(e.data);
      };
      worker.onerror = reject;
      worker.postMessage({
        action: 'compile',
        code: 'void setup() {} void loop() {}',
        boardId: FAST4WD_BOARD_ID,
        toolchainUrl: '/non-existent-manifest.json', // Simulates 404 / missing toolchain
      });
    });
  } catch (err) {
    networkErrorCaught = true;
    log(`  Bắt được lỗi tải toolchain chuẩn xác: ${err.message}`);
  }
  if (!networkErrorCaught) {
    throw new Error('Hệ thống không phát hiện lỗi khi URL toolchain không tồn tại!');
  }

  const mem = window.performance.memory;
  const finalReport = {
    overallStatus: 'PASS',
    browser: navigator.userAgent,
    core: '3.3.7',
    boardId: FAST4WD_BOARD_ID,
    memory: {
      usedJSHeapSize: mem?.usedJSHeapSize,
      totalJSHeapSize: mem?.totalJSHeapSize,
      jsHeapSizeLimit: mem?.jsHeapSizeLimit,
    },
    results,
  };

  statusEl.textContent = 'HOÀN TẤT: TẤT CẢ BÀI TEST PASS';
  log('\n=== TẤT CẢ CÁC BÀI TEST BLOCKLY -> WASM ĐÃ THÀNH CÔNG 100% ===');

  await fetch('/api/test-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalReport),
  });
}

run().catch((err) => {
  log(`LỖI KIỂM THỬ: ${err?.stack || err?.message || String(err)}`);
  statusEl.textContent = 'THẤT BẠI';
  fetch('/api/test-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overallStatus: 'FAIL', error: err?.message || String(err) }),
  }).catch(() => {});
});
