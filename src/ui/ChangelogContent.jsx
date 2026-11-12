import { CHANGELOG, TYPE_LABEL } from './changelog.js';

function ChangelogContent() {
  return (
    <div className="changelog" tabIndex={0} aria-label="Danh sách thay đổi">
      {CHANGELOG.map((entry, index) => (
        <section className="cl-entry" key={entry.version}>
          <div className="cl-head">
            <strong className="cl-ver">Phiên bản {entry.version}</strong>
            {index === 0 && <span className="sel-tag tone-ok">Mới nhất</span>}
            <span className="cl-date">{entry.date}</span>
          </div>
          {entry.title && <p className="cl-title">{entry.title}</p>}
          <ul className="cl-list">
            {entry.items.map((item, itemIndex) => {
              const label = TYPE_LABEL[item.type] || TYPE_LABEL.improved;
              return (
                <li key={itemIndex}>
                  <span className={`sel-tag tone-${label.tone}`}>{label.text}</span>
                  <span>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default ChangelogContent;
