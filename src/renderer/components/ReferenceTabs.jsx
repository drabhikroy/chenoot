// Tabs across the top of the two reference pages.
//
// Response formats and item types share one place in the bar, so each page
// names both and marks the one being read. The tabs are buttons that change
// the page, not a second navigation bar, and they sit above the heading so
// the heading still says which page this is.

const TABS = [
  { id: 'formats', label: 'Response formats' },
  { id: 'itemtypes', label: 'Item types' }
];

export function ReferenceTabs({ current, onChange }) {
  return (
    <div className="reference-tabs" role="tablist" aria-label="Reference">
      {TABS.map(function (tab) {
        const selected = tab.id === current;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            className={'reference-tab' + (selected ? ' current' : '')}
            onClick={function () { onChange(tab.id); }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
