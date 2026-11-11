import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks';
import * as Vietnamese from 'blockly/msg/vi';
import { generateArduino } from '../generators/arduino.js';
import '../blocks/robotics.js';
import { v1StudentToolbox } from '../blocks/beginner-toolbox.js';
import { refreshRobotMotorLabels } from '../blocks/robot-devices.js';
import '../blocks/beginner.js';
import '../blocks/controller.js';
import '../blocks/palette-apply.js';
import { RENDERER, FALLBACK_RENDERER } from '../blocks/renderer.js';
import { themes } from '../blocks/theme.js';

Blockly.setLocale(Vietnamese);

function BlocklyWorkspace({ boardId, editorMode, robotDevices, initialState, dark = false, onChange, onCodeChange, workspaceRef }) {
  const hostRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onCodeChangeRef = useRef(onCodeChange);
  const initialStateRef = useRef(initialState);
  const darkRef = useRef(dark);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  const robotDevicesRef = useRef(robotDevices);
  robotDevicesRef.current = robotDevices;
  const modeRef = useRef(editorMode);
  modeRef.current = editorMode;

  useEffect(() => {
    onChangeRef.current = onChange;
    onCodeChangeRef.current = onCodeChange;
  }, [onChange, onCodeChange]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const options = {
      toolbox: v1StudentToolbox(boardIdRef.current),
      sounds: false,
      trashcan: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: false, wheel: true, startScale: 0.9, maxScale: 1.4, minScale: 0.55, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 3, colour: 'transparent', snap: true },
      theme: darkRef.current ? themes.dark : themes.light,
    };
    let workspace;
    try {
      workspace = Blockly.inject(hostRef.current, { ...options, renderer: RENDERER });
    } catch (error) {
      console.warn('Bộ vẽ khối "codelab" lỗi, chuyển sang zelos.', error);
      hostRef.current.replaceChildren();
      workspace = Blockly.inject(hostRef.current, { ...options, renderer: FALLBACK_RENDERER });
    }
    workspace.codelabBoardId=boardIdRef.current;
    workspace.codelabRobotDevices = robotDevicesRef.current;
    if(workspace.getFlyout()) workspace.getFlyout().getWorkspace().codelabBoardId=boardIdRef.current;
    workspaceRef.current = workspace;

    const flyout = workspace.getFlyout();
    if (flyout) {
      const flyoutScale = workspace.options.zoomOptions?.startScale ?? 0.9;
      flyout.getFlyoutScale = () => flyoutScale;
      flyout.getWorkspace().scale = flyoutScale;
    }

    if (initialStateRef.current) {
      try {
        Blockly.serialization.workspaces.load(initialStateRef.current, workspace);
      } catch {
        workspace.clear();
      }
    }

    let saveTimer;
    const save = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        if (workspace.isDragging()) { save(); return; }
        onChangeRef.current(Blockly.serialization.workspaces.save(workspace));
        onCodeChangeRef.current?.(generateArduino(workspace, boardIdRef.current, robotDevicesRef.current));
      }, 250);
    };
    workspace.addChangeListener(save);

    let tagFrame = 0;
    const tagStacks = () => {
      tagFrame = 0;
      workspace.getAllBlocks(false).forEach((block) => {
        const root = block.getSvgRoot?.();
        if (!root) return;
        root.classList.toggle('has-next', !!block.getNextBlock());
        root.classList.toggle('is-nested', !!block.outputConnection && !!block.getParent());
      });
    };
    const scheduleTag = (event) => {
      if (event?.isUiEvent || tagFrame) return;
      tagFrame = window.requestAnimationFrame(tagStacks);
    };
    workspace.addChangeListener(scheduleTag);
    tagStacks();
    onCodeChangeRef.current?.(generateArduino(workspace, boardIdRef.current, robotDevicesRef.current));

    const tagCategories = () => {
      hostRef.current?.querySelectorAll('.blocklyToolboxCategory').forEach((row, index) => {
        row.style.setProperty('--i', index);
        const colour = row.style.borderLeftColor;
        if (colour && row.style.getPropertyValue('--cat') !== colour) row.style.setProperty('--cat', colour);
      });
    };
    tagCategories();
    const toolboxObserver = new MutationObserver(tagCategories);
    const toolboxDiv = hostRef.current.querySelector('.blocklyToolbox, .blocklyToolboxDiv');
    if (toolboxDiv) toolboxObserver.observe(toolboxDiv, { childList: true, subtree: true });

    const resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace));
    resizeObserver.observe(hostRef.current);

    return () => {
      window.clearTimeout(saveTimer);
      window.cancelAnimationFrame(tagFrame);
      resizeObserver.disconnect();
      toolboxObserver.disconnect();
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [workspaceRef]);

  useEffect(() => {
    const workspace=workspaceRef.current;
    if(workspace) {
      workspace.codelabBoardId=boardId;
      workspace.codelabRobotDevices = robotDevices;
      const flyout = workspace.getFlyout()?.getWorkspace();
      if (flyout) {
        flyout.codelabBoardId = boardId;
        flyout.codelabRobotDevices = robotDevices;
      }
      workspace.updateToolbox(v1StudentToolbox(boardId));
      refreshRobotMotorLabels(workspace);
      onCodeChangeRef.current?.(generateArduino(workspace, boardId, robotDevices));
    }
  }, [boardId, editorMode, robotDevices, workspaceRef]);

  useEffect(() => {
    darkRef.current = dark;
    workspaceRef.current?.setTheme(dark ? themes.dark : themes.light);
  }, [dark, workspaceRef]);

  return <div ref={hostRef} className="blockly-host" aria-label="Vùng lắp ghép khối lệnh" />;
}

export default BlocklyWorkspace;

