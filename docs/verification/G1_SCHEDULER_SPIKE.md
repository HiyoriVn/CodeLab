# G1 Host Scheduler Spike

> Status: **G1_HOST_SPIKE_PASS / ESP32_COMPILE_PASS / FLASH_BUDGET_FAIL**. The host behavior passes. A compile-only probe against the supported V2 profile also compiles, but its measured program storage exceeds the provisional §9.2 64 KiB ceiling. This does not authorize production integration.

## Scope and architecture

Independent C++17 proof of concept in `tools/g1-scheduler/`. It does not include Blockly generator code, production bridge code, Arduino/ESP32 firmware, FreeRTOS, GPIO, or hardware access. The scheduler owns one fixed 16-slot cooperative pool. Each slot owns the approved `ScriptContext` continuation (PC, timer/handle wait state, loop counters, run generation and frame), callback, hat metadata, one pending edge token and a per-tick operation meter. A round-robin cursor invokes each runnable script at most once per tick. The approved callback ABI is `StepResult (*)(ScriptContext&, uint32_t nowMs)`; `WAIT` reads `waitKind` and its timer deadline or motion handle from the context.

`YIELD` leaves a script runnable; `DONE` finishes a startup script or resets an event hat for its next valid edge; `WAIT` suspends only that script. Timers use signed wrap-safe deadline subtraction. Edge tokens are one per hat; opposite edges invalidate queued tokens and dispatch validates current button state. Motion outputs are latched in a mock gate. Timed handles carry `ownerGeneration` and handle ID; expiry only stops a channel if the exact handle still owns its latest command. STOP/FAULT first changes lifecycle and generation, then hard-locks outputs, then cancels contexts and handles. AUTO completes after scripts, pending tokens and motion handles are idle, or faults at its maximum runtime. No per-hat task is created.

The host mock executes safety checks before scheduler work and emits heartbeat only at successful tick return. This is deterministic single-thread behavior; it does not prove real cross-core atomicity. FreeRTOS/Core 0 remains outside this G1 host spike.

## Verification results

Run from repository root with `tools/g1-scheduler/run.ps1`. Raw output, compiler version, code-size samples and scenario results are in `G1_SCHEDULER_SPIKE_HOST.log`.

| Scenario | Result |
|---|---|
| X press t=0, O press t=500 ms, X continuation finishes t=2000 ms | PASS |
| STOP t=750 ms cancels continuation and rejects stale motor write | PASS |
| Rapid press/release/press/release does not replay pending press; fresh later press works | PASS |
| Empty forever yields and does not starve peer scripts | PASS |
| Nested repeat/conditional and timer wait | PASS |
| Old timed-motion timer cannot stop a newer command | PASS |
| Timed motion WAIT and NO_WAIT; natural AUTO waits for active handle | PASS |
| AUTO deadline faults; scheduler heartbeat stall faults | PASS |
| AUTO restart resets continuation and increments run generation | PASS |
| Inlined My Block argument survives wait; recursion and inline limits rejected | PASS |
| 16 scripts accepted, 17th rejected; 256 operations yield quota | PASS |
| Identical input/time trace produces identical ordered fixed-buffer trace | PASS |

## Measurements

Measured on Windows 10.0.26300, MinGW g++ 13.2.0:

| Metric | Observed | §9.2 comparison |
|---|---:|---|
| Script pool | 16 slots | PASS, maximum is 16 |
| Static expanded operation guard | 1024 maximum; 1025 rejected | PASS |
| Per-script per-tick operation budget | 256; quota test yields at 256 | PASS |
| Scheduler object + mock output gate | 9,784 bytes (`sizeof`) | PASS, below 16 KiB |
| Full 16-script benchmark | 10,000 ticks, 160,000 instrumented operations | PASS |
| Maximum observed tick | 10,500 ns (10.5 μs) in recorded run | PASS, below 2 ms; host-only measurement |
| Scheduler core object `.text` | 5,348 bytes, g++ `-Os` | Host object measurement; **not** ESP32 flash usage |
| Test executable | 87,076 bytes, g++ `-O2` | Includes host startup/runtime; not comparable to firmware flash ceiling |
| Trace buffer | 256 fixed entries; overflow counted | PASS, bounded; test confirms drop counter |
| ESP32-S3 V2 probe program storage | 273,583 bytes (8% of 3,342,336) | FAIL against provisional 64 KiB ceiling; includes Arduino Core/runtime and this probe sketch |
| ESP32-S3 V2 probe globals | 31,060 / 327,680 bytes (9%) | Informational whole-sketch RAM; scheduler+gate object remains 9,784 bytes |
| ESP32 binary output | `.ino.bin` 273,728 bytes | Compile artifact only; no upload |

The operation meter counts explicit `accountOperations()` instrumentation at continuation boundaries. It cannot preempt arbitrary uninstrumented native C++ loops; generated callbacks must instrument bounded work and return `YIELD` when the budget is exhausted. The ESP32 compile uses the supported V2 FQBN and Core 3.3.7, but is a temporary probe rather than production generated code. Its 273,583-byte program measurement exceeds 64 KiB, so the §9.2 flash ceiling is a blocker until the owner clarifies/changes the provisional budget or an accepted target measurement shows otherwise. Host object/executable sizes are not substituted for ESP32 flash.

## Build and test commands

```powershell
& tools/g1-scheduler/run.ps1
npm test
npm run build
```

No production generator, firmware, hardware, upload path, branch other than the G1 feature branch, or main branch was modified. This report establishes host PoC behavior only; it is not hardware acceptance.
