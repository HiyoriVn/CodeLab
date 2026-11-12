import { FAST4WD_BOARD_ID, getBoardProfile, projectBoardId } from '../boards/profiles.js';
import { defaultRobotDevices } from '../boards/robot-devices.js';
import { fast4wdConfig } from '../generators/fast4wd.js';
// Compatibility hook retained for older callers. Opening CodeLab must never clear projects.
export function clearOldProjectsOnce(_storage) {}

// Resolve only the active profile; never borrow a configuration from an old board.
export function projectRobotDevices(project) {
  const boardId = projectBoardId(project);
  return project.deviceConfigs?.[boardId] ?? (boardId === FAST4WD_BOARD_ID
    ? defaultRobotDevices(getBoardProfile(boardId)) : undefined);
}

export function newmaniaCopy(project, id) {
  return { ...structuredClone(project), id, name: project.name + ' (Newmania)',
    boardId: FAST4WD_BOARD_ID, editorMode: 'beginner',
    deviceConfigs: { ...structuredClone(project.deviceConfigs),
      [FAST4WD_BOARD_ID]: defaultRobotDevices(getBoardProfile(FAST4WD_BOARD_ID)) },
    updatedAt: new Date().toISOString() };
}

// Report block IDs using runtime validation with the original parent connections.
export function newmaniaCompatibility(workspace, devices) {
  const findings = [];
  for (const block of workspace.getAllBlocks(false)) {
    const warnings = fast4wdConfig({ getAllBlocks: () => [block] }, getBoardProfile(FAST4WD_BOARD_ID), devices).warnings;
    if (warnings.length) findings.push({ id: block.id, type: block.type, warnings });
  }
  return findings;
}
