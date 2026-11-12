// Compile-time dependency is project-wide, as selected by the owner. Device
// configuration alone never makes an autonomous program PS4-dependent.
export function ps4Usage(workspace) {
  let dependent=false,buttons=0,axes=0;
  for (const b of workspace.getAllBlocks(false)) {
    if (!b.isEnabled() || b.getInheritedDisabled()) continue;
    if (['newmania_design_ps4_connect','newmania_design_ps4_button','robot_ps4_axis','robot_ps4_button','robot_ps4_event','fast4wd_connected','fast4wd_connect','fast4wd_drive'].includes(b.type)) dependent=true;
    if (['newmania_design_ps4_button','robot_ps4_button','robot_ps4_event'].includes(b.type)) buttons |= 1 << Number(b.getFieldValue('BUTTON'));
    if (b.type==='robot_ps4_axis') axes |= 1 << Number(b.getFieldValue('AXIS'));
    if (b.type==='fast4wd_drive') axes |= 7;
  }
  // Connection-only programs still require neutral + a new controller action
  // before motor outputs can resume. Options/Share have no system role.
  return {dependent,buttons:buttons || 0x1fcff,axes:axes || (buttons ? 0 : 7)};
}
