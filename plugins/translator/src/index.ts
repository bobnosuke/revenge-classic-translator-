import { findByName, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { React, ReactNative } from "@vendetta/metro/common";
const cache = new Map();
const pending = new Set();
const queue = [];
let running = 0, stopped = false, unpatch = null;
let channelStore = null, selectedStore = null;
let hookState = "not started";
let apiState = "not tested";
let renderState = "not tested";
let counters = { seen: 0, eligible: 0, queued: 0, translated: 0, failed: 0, skippedPrivate: 0, applied: 0, applyErrors: 0 };
function eligible(s) { return typeof s === "string" && s.length >= 3 && s.length <= 450 && /[a-z]/i.test(s) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(s) && !/^\s*(https?:\/\/|\x60\x60\x60|<@!?\d+>)/.test(s); }
function pump() {
  while (!stopped && running < 2 && queue.length) {
    const {key, value} = queue.shift(); running++;
    (async () => {
      try {
        const r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(value) + "&langpair=en%7Cja");
        if (!r.ok) throw Error("HTTP " + r.status);
        const data = await r.json();
        const text = data?.responseData?.translatedText;
        if (Number(data?.responseStatus) === 200 && typeof text === "string" && text.trim()) {
          if (cache.size >= 300) cache.delete(cache.keys().next().value);
          cache.set(key, text);
          counters.translated++;
          apiState = "translation success";
          console.log("[ClassicTranslator] translation cached", counters.translated);
        }
      } catch(e) { counters.failed++; apiState = "error: " + String(e); console.warn("[ClassicTranslator] API error", String(e)); }
      finally { pending.delete(key); running--; pump(); }
    })();
  }
}
function translateRow(row, ret) {
  try {
    if (storage?.enabled === false || row?.rowType !== 1) return;
    counters.seen++;
    const m = ret?.message;
    const source = typeof m?.content === "string" ? m.content : row?.message?.content;
    if (!m || !eligible(source)) return;
    counters.eligible++;
    // Only guild messages are processed by default; never upload private DM text.
    const channelId = m.channel_id || m.channelId || row?.message?.channel_id || row?.message?.channelId || selectedStore?.getChannelId?.();
    const channel = channelId ? channelStore?.getChannel?.(channelId) : null;
    const guild = m.guild_id || m.guildId || row?.message?.guild_id || row?.message?.guildId || channel?.guild_id || channel?.guildId;
    if (!guild && !storage?.allowPrivate) { counters.skippedPrivate++; return; }
    const key = "en-ja:" + source;
    const value = cache.get(key);
    if (value) {
      const replacement = storage?.showOriginal ? value + "\n\n[Original] " + source : value;
      try {
        // RowManager.generate is observed to expose ret.message, but the renderer
        // may have already built its rich-text nodes from row.message. Update both
        // generated and source row copies; never mutate the Discord store itself.
        const safe = {...m, content: replacement};
        ret.message = safe;
        if (row?.message && typeof row.message === "object") row.message = {...row.message, content: replacement};
        counters.applied++;
        renderState = "patched row.message and ret.message";
      } catch (e) {
        counters.applyErrors++;
        renderState = "error: " + String(e);
        console.warn("[ClassicTranslator] render patch error", String(e));
      }
    } else if (!pending.has(key) && queue.length < 80 && !stopped) {
      pending.add(key); counters.queued++; queue.push({key, value:source}); pump();
    }
  } catch(e) { console.warn("[ClassicTranslator] guarded row hook error", String(e)); }
}
export default {
  onLoad() {
    stopped = false;
    try { storage.enabled ??= true; storage.allowPrivate ??= false; storage.showOriginal ??= false; } catch {}
    try { channelStore = findByStoreName("ChannelStore"); selectedStore = findByStoreName("SelectedChannelStore"); } catch (e) { console.warn("[ClassicTranslator] channel stores unavailable", String(e)); }
    const rows = findByName("RowManager");
    if (!rows?.prototype?.generate) {
      hookState = "RowManager.generate missing";
      console.warn("[ClassicTranslator] RowManager.generate not found; no patch applied.");
      return;
    }
    unpatch = after("generate", rows.prototype, ([row], ret) => translateRow(row, ret));
    hookState = "RowManager hook installed";
    console.log("[ClassicTranslator] v0.3 enabled; translations appear when rows rerender. Status available at globalThis.__classicTranslatorStatus");
    try { globalThis.__classicTranslatorStatus = () => ({...counters, cache: cache.size, pending: pending.size, hookState, apiState}); } catch {}
  },
  settings: () => React.createElement(ReactNative.ScrollView, {style:{padding:16}},
    React.createElement(ReactNative.Text, {style:{color:"#fff",fontSize:19,fontWeight:"bold",marginBottom:12}}, "Classic Translator Diagnostics"),
    ...[
      "Hook: " + hookState,
      "API: " + apiState,
      "Render patch: " + renderState,
      "Rows patched: " + counters.applied,
      "Render patch errors: " + counters.applyErrors,
      "Rows observed: " + counters.seen,
      "English candidates: " + counters.eligible,
      "Translation requests: " + counters.queued,
      "Translations returned: " + counters.translated,
      "API failures: " + counters.failed,
      "Private messages skipped: " + counters.skippedPrivate,
      "Cache entries: " + cache.size,
      "Tip: leave this page, view an English message, then reopen this page to refresh the numbers."
    ].map(t => React.createElement(ReactNative.Text,{key:t,style:{color:"#fff",fontSize:15,marginBottom:10}},t))
  ),
  onUnload() {
    stopped = true; queue.length = 0;
    try { unpatch?.(); } catch {}
    unpatch = null; pending.clear(); cache.clear(); channelStore = null; selectedStore = null;
    try { delete globalThis.__classicTranslatorStatus; } catch {}
  }
};