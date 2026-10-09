import { useLanguage } from "../i18n";

export default function PortalLangToggle({ tone = "dark" }) {
  const { lang, setLang } = useLanguage();
  const on = tone === "light" ? "bg-brand-800 text-white" : "bg-white text-ink";
  const off = tone === "light" ? "text-ink" : "text-white/80";
  const shell = tone === "light" ? "border border-line bg-white" : "bg-white/10";
  return (
    <div className={`inline-flex rounded-lg p-0.5 text-xs font-semibold ${shell}`}>
      {[
        ["zh", "中"],
        ["en", "Eng"],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={lang === id}
          className={`rounded-md px-2.5 py-1 ${lang === id ? on : off}`}
          onClick={() => setLang(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
