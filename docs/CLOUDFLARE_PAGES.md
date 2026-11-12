# Cloudflare Pages + USB firmware

Static Pages hosts Blockly/Vite, not Arduino CLI. esptool-js 0.7.1 flashes precompiled binaries only. No Railway service is required for editing, C++ generation or flashing an existing package. Compiling new C++ still requires the local bridge or a separately designed cloud compiler; no cloud compile API is implemented here.

## Deploy without pushing Git

Run npm ci and npm run build. In Cloudflare dashboard: Workers & Pages → Create application → Pages → Direct Upload / Upload assets. Name the project, upload the contents of dist (not source), then Deploy. Open the HTTPS pages.dev URL. No Git push is needed. Alternatively authenticate with npx wrangler login, then npx wrangler pages deploy dist --project-name codelab. Account/project selection must match the user's Cloudflare account.

For Git integration later: select HiyoriVn/CodeLab, production branch codex/robot-mvp-integration, framework React (Vite), root repository directory, build npm run build, output dist, Node 22. This only deploys pushed commits; local changes are not included. No push/merge is performed by this task. Keep Pages Functions and compile secrets out of this static deployment.

## Prepare firmware (no compile or flash)

Use an existing successful Arduino CLI build with build.options.json and flash_args. Run:

    node tools/package-browser-firmware.mjs <build-directory>

The directory must contain the four files named by flash_args. Arduino exports may omit boot_app0.bin: copy it from the SAME installed esp32 core 3.3.7 tools/partitions/boot_app0.bin into the build directory. The packager fails closed on missing files, profile/core mismatch, wrong chip image header, unexpected offsets/partition layout or oversized images. It creates codelab-flash.json without overwriting an existing manifest. It does not compile or select USB.

Core 3.3.7 source checked locally: boards.txt esp32s3.build.bootloader_addr=0x0; platform.txt tools.esptool_py.upload.pattern_args uses bootloader 0x0, partitions 0x8000, boot_app0 0xe000 and app 0x10000. default_8MB.csv app0 capacity is 0x330000. Do not apply ESP32's generic 0x1000 bootloader offset to ESP32-S3. Newmania FQBN is read unchanged from src/boards/profiles.js.

## Browser steps

Desktop Chrome/Edge, HTTPS or localhost. Export project JSON before changing origins: localStorage is per origin, so localhost projects do not automatically appear on pages.dev. Existing local data is not removed.

Open Connect, select manifest plus its four .bin files. Hashes and layout are checked before enabling USB. Close other serial tools, verify Newmania and existing default_8MB layout, disconnect motor power, check confirmation, then press Choose USB and flash. Chip detection must return ESP32-S3 before writeFlash. Detection may reset the board into bootloader. No automatic post-flash reset/run is requested; after success, disconnect safely before manually resetting. On USB cancellation/error the transport closes and confirmation clears. Do not use for boards whose existing partition layout is unknown.

eraseAll=false: only the listed ranges are written, including bootloader, partition table, OTA metadata and app0. This replaces running firmware/OTA selection; it is not a backup/restore tool. NVS and filesystem are outside the writes when the existing layout matches. SHA-256 binds package files together, not publisher authenticity; use trusted builds.

## Checks

npm test; npm run build. Hardware and deployed-origin USB remain manual acceptance checks. Test file picker validation, cancel USB chooser, busy modal guard, unplug/error recovery and wrong-chip rejection before an individually authorized real flash. Check Blockly, project export/import and reload on the deployed URL. No actual device flashing is authorized for this task.

Before writing, the device must report 16MB flash and its installed partition-table bytes must match the package exactly. Blank or different-layout boards are rejected. All four written ranges are read back and checked with SHA-256 before reporting success. No project cleanup/reset runs when opening the editor.

## Local review fixes — 2026-11-12

Bridge refresh/compile/upload and browser USB now acquire a shared operation
lock before starting. Both panels disable their controls while it is held;
modal Escape/backdrop and Close are blocked until the operation finishes.
The lock rejects repeated clicks synchronously and releases on cancellation or
failure. Import finishing during a device operation retains the current project
and asks the user to reopen the file later.

On static origins the bridge refresh action is disabled and no `/api/*` probe
runs. The firmware packager matches the exact Core 3.3.7 path component rather
than accepting version prefixes. Invalid manifests/short partition tables have
a package diagnostic; a USB cleanup failure preserves the original error.

`tests/device-operation-ui.test.mjs` mounts the actual React panels and modal in
jsdom with mocked network/USB chooser. It covers both lock directions, repeated
clicks, Escape/backdrop, cancellation, bridge failure and static-origin behavior.
This is DOM simulation, not live-browser or hardware acceptance. Packager tests
write synthetic build fixtures without invoking a compiler or selecting ports.
