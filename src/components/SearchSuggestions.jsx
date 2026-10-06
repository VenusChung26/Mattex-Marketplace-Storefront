import { foldHan } from "../lib/han";

function highlightMatch(text, query) {
  const raw = String(text || "");
  const folded = foldHan(raw).toLowerCase();
  const tokens = foldHan(String(query || "").trim())
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!raw || !tokens.length) return raw;
  const marks = Array(raw.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    while (from < folded.length) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      for (let i = at; i < at + token.length && i < marks.length; i += 1) marks[i] = true;
      from = at + Math.max(token.length, 1);
    }
  }
  const parts = [];
  let index = 0;
  while (index < raw.length) {
    const on = marks[index];
    let end = index + 1;
    while (end < raw.length && marks[end] === on) end += 1;
    const slice = raw.slice(index, end);
    parts.push(on ? (
      <mark key={index} className="bg-transparent font-semibold text-brand-800">
        {slice}
      </mark>
    ) : slice);
    index = end;
  }
  return parts;
}

export default function SearchSuggestions({ query, suggestions, activeIndex = -1, onPick }) {
  if (!suggestions?.length) return null;
  return (
    <ul role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto border border-line bg-white text-ink shadow-lg">
      {suggestions.map((product, index) => (
        <li key={product.id}>
          <button
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-brand-50" : "hover:bg-paper"}`}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(product);
            }}
          >
            <span className="block leading-snug">{highlightMatch(product.name, query)}</span>
            <span className="mt-0.5 block truncate text-[11px] text-mute">
              {highlightMatch([product.productNo || product.provisionalSku, product.category].filter(Boolean).join(" · "), query)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
