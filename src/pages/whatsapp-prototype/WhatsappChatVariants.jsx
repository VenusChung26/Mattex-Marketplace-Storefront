/**
 * PROTOTYPE — WhatsApp chat after Create Order.
 * Question: How should the buyer ask the supplier “I want to buy these items”?
 * A Mobile chat · B WhatsApp Web · C Order ticket + chat
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../../lib/store";
import { scrollNodeIntoView } from "../../lib/scrollInto";
import { SHOW_RFQ } from "../../lib/flags";
import { useLanguage } from "../../i18n";

export const WA_CHAT_VARIANTS = [
  { key: "A", name: "Mobile chat" },
  { key: "B", name: "WhatsApp Web" },
  { key: "C", name: "Order ticket + chat" },
];

function WaLogo({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.5 2 2 6.36 2 11.73c0 1.72.46 3.4 1.34 4.88L2 22l5.55-1.45a10.3 10.3 0 0 0 4.49 1.02h.04c5.54 0 10.04-4.36 10.04-9.73C22.12 6.36 17.58 2 12.04 2Zm5.83 13.8c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.79-4.18-4.93-4.38-.14-.2-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.36.24-.26.64-.38 1.02-.38.12 0 .23 0 .33.01.29.01.43.03.62.48.24.56.82 2 .89 2.14.07.14.12.31.02.5-.1.2-.15.31-.3.48l-.44.5c-.14.15-.3.32-.13.62.17.3.76 1.25 1.63 2.03 1.13 1 2.08 1.32 2.4 1.47.3.14.48.12.66-.07.18-.2.77-.9.98-1.2.2-.31.41-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.22.57.35.07.12.07.7-.17 1.38Z" />
    </svg>
  );
}

function Ticks({ outgoing }) {
  return (
    <svg viewBox="0 0 16 11" className={`inline-block h-3 w-4 ${outgoing ? "text-[#53bdeb]" : "text-[#8696a0]"}`} fill="currentColor">
      <path d="M11.07 1.14 5.4 7.04 3.07 4.7l-.9.9 3.23 3.24.9.9.9-.9 6.57-6.8-.9-.9Z" />
      <path d="M14.2 1.14 8.53 7.04l-.6-.62.9-.9 5.07-5.28-.7-.1Z" opacity=".85" />
    </svg>
  );
}

function OrderCards({ lines, t, editable, onChangeLine, onRemoveLine }) {
  return (
    <div className="space-y-1.5">
      {(lines || []).map((line) => (
        <div key={line.productId} className="overflow-hidden rounded-lg bg-black/5">
          <div className="flex gap-2">
            {line.image ? (
              <img src={line.image} alt="" className="h-14 w-14 shrink-0 object-cover" />
            ) : (
              <div className="h-14 w-14 shrink-0 bg-[#dfe5dc]" />
            )}
            <div className="min-w-0 flex-1 py-1.5 pr-2">
              <p className="truncate text-[13px] font-semibold leading-snug text-[#111b21]">{line.name}</p>
              {(line.custom && line.quotedUnitPrice == null) || line.unitPrice == null ? (
                <p className="text-[11px] text-[#667781]">{formatPrice(null)}</p>
              ) : (
                <p className="text-[11px] text-[#667781]">{formatPrice(line.unitPrice)}</p>
              )}
              {line.supplier ? <p className="truncate text-[10px] text-[#8696a0]">{line.supplier}</p> : null}
              {editable ? (
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[11px] text-[#667781]">
                    {t("qty")}
                    <input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => {
                        const next = Math.max(1, Math.floor(Number(e.target.value)) || 1);
                        onChangeLine?.(line.productId, { qty: next });
                      }}
                      className="w-12 rounded border border-black/10 bg-white px-1 py-0.5 text-[12px] text-[#111b21]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveLine?.(line.productId)}
                    className="text-[11px] font-semibold text-[#b3261e] hover:underline"
                  >
                    {t("waRemoveLine")}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[#667781]">{t("waQty", { n: line.qty })}</p>
              )}
            </div>
          </div>
          {editable ? (
            <div className="border-t border-black/5 px-2 py-1.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#667781]">
                {t("waRemark")}
                <input
                  type="text"
                  value={line.remark || ""}
                  placeholder={t("waRemarkPlaceholder")}
                  onChange={(e) => onChangeLine?.(line.productId, { remark: e.target.value })}
                  className="mt-0.5 w-full rounded border border-black/10 bg-white px-1.5 py-1 text-[12px] text-[#111b21] placeholder:text-[#8696a0]"
                />
              </label>
            </div>
          ) : line.remark ? (
            <p className="border-t border-black/5 px-2 py-1 text-[11px] text-[#54656f]">{line.remark}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Bubble({ msg, t, onChangeLine, onRemoveLine }) {
  const mine = msg.from === "me";
  const quote = msg.askKind === "quote";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          mine ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
        }`}
      >
        {msg.kind === "order" ? (
          <div className="min-w-[14rem]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#075e54]">
              {quote ? t("waQuoteCard") : t("waOrderCard")}
            </p>
            <p className="mb-2 whitespace-pre-wrap text-[14.2px] leading-[19px] text-[#111b21]">{msg.text}</p>
            <OrderCards
              lines={msg.lines}
              t={t}
              editable={mine}
              onChangeLine={onChangeLine}
              onRemoveLine={onRemoveLine}
            />
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[14.2px] leading-[19px] text-[#111b21]">{msg.text}</p>
        )}
        <p className={`mt-0.5 flex items-center justify-end gap-0.5 text-[11px] text-[#667781] ${mine ? "" : ""}`}>
          <span>{msg.time}</span>
          {mine ? <Ticks outgoing /> : null}
        </p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696a0] [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, t, dark = false }) {
  return (
    <form
      className={`flex items-end gap-2 px-2 py-2 ${dark ? "bg-[#202c33]" : "bg-[#f0f2f5]"}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div className={`flex min-h-[42px] flex-1 items-end rounded-full px-3 py-2 ${dark ? "bg-[#2a3942]" : "bg-white"}`}>
        <textarea
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={t("waPlaceholder")}
          className={`max-h-24 w-full resize-none bg-transparent text-[15px] outline-none ${
            dark ? "text-[#e9edef] placeholder:text-[#8696a0]" : "text-[#111b21] placeholder:text-[#667781]"
          }`}
        />
      </div>
      <button
        type="submit"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white"
        aria-label={t("waPlaceholder")}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}

function ChatWallpaper({ children, className = "" }) {
  return (
    <div
      className={`relative overflow-y-auto ${className}`}
      style={{
        backgroundColor: "#efeae2",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8 6h2v2H8zM28 22h2v2h-2zM44 10h2v2h-2zM12 40h2v2h-2zM36 48h2v2h-2z' fill='%23cfc5b8' fill-opacity='.45'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </div>
  );
}

function MessageList({ messages, typing, t, onChangeLine, onRemoveLine }) {
  const endRef = useRef(null);
  useEffect(() => {
    scrollNodeIntoView(endRef.current, { block: "end" });
  }, [messages, typing]);
  return (
    <div className="space-y-1.5 px-3 py-3">
      <div className="flex justify-center">
        <span className="rounded-lg bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#54656f] shadow-sm">
          {t("waToday")}
        </span>
      </div>
      {messages.map((msg) => (
        <Bubble key={msg.id} msg={msg} t={t} onChangeLine={onChangeLine} onRemoveLine={onRemoveLine} />
      ))}
      {typing ? <TypingDots /> : null}
      <div ref={endRef} />
    </div>
  );
}

function MobileHeader({ thread, t, onBack }) {
  return (
    <header className="flex items-center gap-2 bg-[#075e54] px-2 py-2 text-white">
      {onBack ? (
        <button type="button" onClick={onBack} className="px-1 text-lg leading-none" aria-label="Back">
          ‹
        </button>
      ) : null}
      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0b6a5f] text-sm font-bold">
        {(thread.supplier || "?").slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-tight">{thread.supplier}</p>
        <p className="text-[12px] text-white/80">{t("waOnline")}</p>
      </div>
      <WaLogo className="h-5 w-5 text-white/90" />
    </header>
  );
}

export function VariantA({
  threads,
  activeSlug,
  setActiveSlug,
  messages,
  typing,
  draftText,
  setDraftText,
  onSend,
  isDemo,
  rfq,
  askPreview,
  onChangeLine,
  onRemoveLine,
}) {
  const { t } = useLanguage();
  const thread = threads.find((x) => x.slug === activeSlug) || threads[0];
  const showList = threads.length > 1 && !activeSlug;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#0b141a] px-3 py-6">
      <div className="flex h-[720px] w-full max-w-[390px] flex-col overflow-hidden rounded-[1.75rem] border-[8px] border-[#1f2c34] bg-[#0b141a] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        {showList ? (
          <>
            <header className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
              <p className="text-lg font-semibold">{t("waChats")}</p>
              <WaLogo />
            </header>
            <ul className="flex-1 overflow-y-auto bg-[#111b21]">
              {threads.map((item) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => setActiveSlug(item.slug)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-sm font-bold text-white">
                      {item.supplier.slice(0, 1)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[#e9edef]">{item.supplier}</span>
                      <span className="block truncate text-xs text-[#8696a0]">
                        {askPreview} · {item.lines.length}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <MobileHeader
              thread={thread}
              t={t}
              onBack={threads.length > 1 ? () => setActiveSlug("") : undefined}
            />
            <ChatWallpaper className="flex-1">
              <MessageList
                messages={messages}
                typing={typing}
                t={t}
                onChangeLine={onChangeLine}
                onRemoveLine={onRemoveLine}
              />
            </ChatWallpaper>
            <Composer value={draftText} onChange={setDraftText} onSend={onSend} t={t} />
          </>
        )}
      </div>
      <p className="sr-only">
        {t("waDemoState", { supplier: thread?.supplier || "", n: messages.length })} {isDemo ? t("waDemoHint") : rfq?.id}
      </p>
    </div>
  );
}

export function VariantB({
  threads,
  activeSlug,
  setActiveSlug,
  messages,
  typing,
  draftText,
  setDraftText,
  onSend,
  askPreview,
  onChangeLine,
  onRemoveLine,
}) {
  const { t } = useLanguage();
  const thread = threads.find((x) => x.slug === activeSlug) || threads[0];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0b141a] p-3 sm:p-5">
      <div className="mx-auto flex h-[min(860px,calc(100vh-5.5rem))] max-w-6xl overflow-hidden rounded-sm border border-white/10 bg-[#111b21] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <aside className="flex w-[38%] min-w-[16rem] max-w-sm flex-col border-r border-white/10 bg-[#111b21]">
          <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white">
              <WaLogo className="h-5 w-5" />
            </span>
            <p className="font-semibold text-[#e9edef]">{t("waChats")}</p>
          </div>
          <div className="px-3 py-2">
            <div className="rounded-lg bg-[#202c33] px-3 py-2 text-sm text-[#8696a0]">{t("waSearchChats")}</div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {threads.map((item) => {
              const on = item.slug === thread.slug;
              return (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => setActiveSlug(item.slug)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${on ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] font-bold text-white">
                      {item.supplier.slice(0, 1)}
                    </span>
                    <span className="min-w-0 border-b border-white/5 pb-3">
                      <span className="flex justify-between gap-2">
                        <span className="truncate font-semibold text-[#e9edef]">{item.supplier}</span>
                        <span className="shrink-0 text-[11px] text-[#8696a0]">{item.previewTime}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-[#8696a0]">
                        {t("waYou")}: {askPreview}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 bg-[#202c33] px-4 py-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] font-bold text-white">
              {thread.supplier.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[#e9edef]">{thread.supplier}</p>
              <p className="text-xs text-[#8696a0]">{t("waOnline")}</p>
            </div>
          </header>
          <ChatWallpaper className="flex-1">
            <MessageList
              messages={messages}
              typing={typing}
              t={t}
              onChangeLine={onChangeLine}
              onRemoveLine={onRemoveLine}
            />
          </ChatWallpaper>
          <Composer value={draftText} onChange={setDraftText} onSend={onSend} t={t} dark />
        </section>
      </div>
    </div>
  );
}

export function VariantC({
  threads,
  activeSlug,
  setActiveSlug,
  messages,
  typing,
  draftText,
  setDraftText,
  onSend,
  rfq,
  isDemo,
  onChangeLine,
  onRemoveLine,
}) {
  const { t } = useLanguage();
  const thread = threads.find((x) => x.slug === activeSlug) || threads[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {rfq?.askKind === "quote" ? t("waQuoteCard") : t("waOrderCard")}
          </p>
          <h2 className="mt-1 text-lg font-bold text-brand-800">{rfq?.id || "DEMO"}</h2>
          {isDemo ? <p className="mt-2 text-xs text-mute">{t("waDemoHint")}</p> : null}
          {rfq?.project ? <p className="mt-2 text-sm text-ink">{rfq.project}</p> : null}
          <p className="mt-1 text-sm font-semibold text-brand-700">
            {formatPrice(rfq?.pricedSubtotal || 0)}
          </p>
        </div>
        <div className="border border-line bg-white">
          <p className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-mute">
            {t("suppliers")}
          </p>
          <ul>
            {threads.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => setActiveSlug(item.slug)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                    item.slug === thread.slug ? "bg-brand-50 font-semibold text-brand-800" : "text-ink hover:bg-paper"
                  }`}
                >
                  <span className="truncate">{item.supplier}</span>
                  <span className="text-xs text-mute">{item.lines.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {SHOW_RFQ ? (
          <Link to="/rfqs" className="btn-primary !py-2 !px-3 text-sm">
            {t("waViewRfqs")}
          </Link>
          ) : null}
          <Link to="/rfq" className="btn-soft !py-2 !px-3 text-sm">
            {t("waBackDraft")}
          </Link>
        </div>
      </aside>
      <div className="flex min-h-[32rem] flex-col overflow-hidden border border-line bg-white">
        <MobileHeader thread={thread} t={t} />
        <ChatWallpaper className="flex-1">
          <MessageList
            messages={messages}
            typing={typing}
            t={t}
            onChangeLine={onChangeLine}
            onRemoveLine={onRemoveLine}
          />
        </ChatWallpaper>
        <Composer value={draftText} onChange={setDraftText} onSend={onSend} t={t} />
      </div>
    </div>
  );
}
