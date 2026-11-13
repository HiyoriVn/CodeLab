export function debugMetadata(build) {
  return {
    buildId: build.buildId, boardId: build.boardId,
    toolchainVersion: build.toolchainVersion, compilerRevision: build.compilerRevision,
    libraryRevision: build.libraryRevision, fqbn: build.manifest.fqbn,
    elfSha256: build.debug.elfSha256, appSha256: build.debug.appSha256,
    manifest: build.manifest, stats: build.stats,
    // Includes injected prototypes and #line directives, exactly as compiled.
    source: build.debug.source,
  };
}

export function downloadDebugArtifact(build, kind) {
  const isElf = kind === 'elf';
  const blob = new Blob([isElf ? build.debug.elf : JSON.stringify(debugMetadata(build), null, 2)],
    { type: isElf ? 'application/octet-stream' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${build.buildId}.${isElf ? 'elf' : 'debug.json'}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
