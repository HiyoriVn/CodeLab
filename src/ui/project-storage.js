export function clearOldProjectsOnce(storage) {
  const marker = 'codelab.projects.reset.20261111';
  if (storage.getItem(marker)) return;
  storage.removeItem('codelab.projects.v1');
  storage.removeItem('codelab.workspace.v1');
  storage.setItem(marker, 'done');
}
