// Revenge Classic / Vendetta experimental plugin.
// This is intentionally a safe scaffold: no Discord message objects are mutated.
import { logger, storage } from "@vendetta";
import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";

const CACHE_LIMIT = 300;
const cache = new Map();
let unpatches = [];
let active = false;

const defaults = { enabled: true, target: "ja", translatePrivate: false, showOriginal: true };
function config() { return { ...defaults, ...storage }; }
function eligible(s) {
  return typeof s === "string" && s.length >= 3 && s.length <= 450 &&
    /[a-zA-Z]/.test(s) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(s) &&
    !/^\\s*(https?:\\/\\/|\\x60\\x60\\x60)/.test(s);
}
async function translate(s) {
  if (!eligible(s)) return s;
  if (cache.has(s)) return cache.get(s);
  const query = encodeURIComponent(s);
  const url = "https://api.mymemory.translated.net/get?q=" + query + "&langpair=en%7Cja";
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  const translated = json?.responseData?.translatedText;
  if (json?.responseStatus !== 200 || !translated) throw new Error("No translation");
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(s, translated);
  return translated;
}
export default {
  onLoad() {
    active = true;
    logger.log("[ClassicTranslator] Prototype loaded. UI integration is NOT active.");
    // Do not hook unknown Metro modules: Discord 348.10 renderer shape
    // must be checked against a real device before enabling auto-translation.
  },
  onUnload() {
    active = false;
    for (const undo of unpatches.splice(0)) { try { undo(); } catch {} }
    cache.clear();
  }
};
