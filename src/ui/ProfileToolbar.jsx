import Select from './Select.jsx';

const MODES = [
  { value: 'beginner', label: 'Cơ bản' },
  { value: 'advanced', label: 'Nâng cao' },
];

const toneOf = (text) => {
  const t = text.toLowerCase();
  if (t.includes('experimental')) return 'warn';
  if (t.includes('target')) return 'ok';
  if (t.includes('test')) return 'info';
  return 'neutral';
};

function boardOption(board) {
  const match = board.name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const label = match ? match[1] : board.name;
  const tags = match ? match[2].split(',').map((part) => part.trim()).filter(Boolean).map((text) => ({ text, tone: toneOf(text) })) : [];
  const memory = [];
  if (board.flashMB) memory.push(`Flash ${board.flashMB}MB`);
  if (board.psramMB > 0) memory.push(`PSRAM ${board.psramMB}MB ${board.psramType}`);
  else if (board.psramMB === 0) memory.push('Không PSRAM');
  return { value: board.id, label, tags, hint: [board.mcu, ...memory].join(' · ') };
}

function ProfileToolbar({ editorMode, onMode, boardId, boards, onBoard, lessons, onLesson, status }) {
  const boardOptions = boards.map(boardOption);
  const lessonOptions = lessons.map((lesson) => ({ value: lesson.id, label: lesson.label }));

  return (
    <div className="board-profile-toolbar" role="toolbar" aria-label="Board và bài mẫu">
      {onMode && (
        <div className="tb-field">
          <span className="tb-label" id="tb-mode-label">Chế độ</span>
          <Select labelId="tb-mode-label" value={editorMode} options={MODES} onChange={onMode} />
        </div>
      )}
      <div className="tb-field">
        <span className="tb-label" id="tb-board-label">Board</span>
        <Select labelId="tb-board-label" className="sel-board" value={boardId} options={boardOptions} onChange={onBoard} />
      </div>
      <div className="tb-field">
        <span className="tb-label" id="tb-lesson-label">Bài mẫu</span>
        <Select
          labelId="tb-lesson-label"
          className="sel-lesson"
          value=""
          options={lessonOptions}
          onChange={onLesson}
          placeholder="Chọn bài mẫu..."
          menuHeader="Mở bài mẫu"
        />
      </div>
      {status && <small className="tb-status" role="status">{status}</small>}
    </div>
  );
}

export default ProfileToolbar;
