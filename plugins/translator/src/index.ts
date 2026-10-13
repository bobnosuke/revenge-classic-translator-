import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
const cache = new Map();
const pending = new Set();
const queue = [];
let running = 0, stopped = false, unpatch = null;
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
        }
      } catch(e) { console.warn("[ClassicTranslator] API error", String(e)); }
      finally { pending.delete(key); running--; pump(); }
    })();
  }
}
function translateRow(row, ret) {
  try {
    if (storage?.enabled === false || row?.rowType !== 1) return;
    const m = ret?.message;
    if (!m || !eligible(m.content)) return;
    // Only guild messages are processed by default; never upload private DM text.
    const guild = m.guild_id || m.guildId || row?.message?.guild_id || row?.message?.guildId;
    if (!guild && !storage?.allowPrivate) return;
    const key = "en-ja:" + m.content;
    const value = cache.get(key);
    if (value) {
      ret.message = {...m, content: storage?.showOriginal ? value + "\n\n[Original] " + m.content : value};
    } else if (!pending.has(key) && queue.length < 80 && !stopped) {
      pending.add(key); queue.push({key, value:m.content}); pump();
    }
  } catch(e) { console.warn("[ClassicTranslator] guarded row hook error", String(e)); }
}
export default {
  onLoad() {
    stopped = false;
    try { storage.enabled ??= true; storage.allowPrivate ??= false; storage.showOriginal ??= false; } catch {}
    const rows = findByName("RowManager");
    if (!rows?.prototype?.generate) {
      console.warn("[ClassicTranslator] RowManager.generate not found; no patch applied.");
      return;
    }
    unpatch = after("generate", rows.prototype, ([row], ret) => translateRow(row, ret));
    console.log("[ClassicTranslator] enabled; cached translations appear when rows rerender");
  },
  onUnload() {
    stopped = true; queue.length = 0;
    try { unpatch?.(); } catch {}
    unpatch = null; pending.clear(); cache.clear();
  }
};