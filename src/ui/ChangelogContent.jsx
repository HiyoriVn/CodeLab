import { useState } from 'react';
import { CHANGELOG, TYPE_LABEL } from './changelog.js';

function ChangelogContent() {
  const [active, setActive] = useState(0);
  const entry = CHANGELOG[active] || CHANGELOG[0];

  return (
    <div className="changelog">
      <div className="cl-nav" role="tablist" aria-orientation="vertical" aria-label="Các phiên bản">
        {CHANGELOG.map((item, index) => (
          <button
            key={item.version}
            type="button"
            role="tab"
            id={`cl-tab-${index}`}
            aria-selected={index === active}
            aria-controls="cl-panel"
            className={`cl-tile${index === active ? ' is-active' : ''}`}
            onClick={() => setActive(index)}
          >
            <strong>Bản {item.version}</strong>
            <span>{item.date}</span>
            {index === 0 && <span className="sel-tag tone-ok">Mới nhất</span>}
          </button>
        ))}
      </div>
      <section className="cl-entry" id="cl-panel" role="tabpanel" aria-labelledby={`cl-tab-${active}`} tabIndex={0}>
        <div className="cl-head">
          <strong className="cl-ver">Phiên bản {entry.version}</strong>
          {active === 0 && <span className="sel-tag tone-ok">Mới nhất</span>}
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
    </div>
  );
}

export default ChangelogContent;
