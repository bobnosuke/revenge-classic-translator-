# Revenge Classic Translator

**Target:** Revenge `1b1d297-main`, Discord Android `348.10 (348010)`.

## Installable preview

Paste this URL into **Revenge → Plugins → +**:

```
https://cdn.jsdelivr.net/gh/bobnosuke/revenge-classic-translator-@main/dist/translator/
```

The plugin bundle and Vendetta-compatible `manifest.json` are in `dist/translator/`. GitHub Actions builds them from `plugins/translator/src/index.ts` and verifies the build succeeds. **Device runtime compatibility is not yet verified.**

## Current behavior and limits

- Uses free public MyMemory API to translate eligible Latin-script chat messages into Japanese.
- Processes message rows as Discord renders them, including scrolled-in history and new messages.
- **Translation is asynchronous and becomes visible only when Discord renders that row again** (for example, scrolling away and back). Immediate in-place refresh is not implemented.
- Default: translates guild messages only. DMs and private conversations without a guild id are not sent to MyMemory.
- In-memory cache (300 entries), queue (80 entries), two concurrent requests.
- Does not send or edit Discord messages on the server.
- May fail if Discord 348.10 has changed the RowManager component. Plugin logs an error instead of patching an unknown module.
- Settings defaults exist in plugin storage, but there is no settings UI yet.

**Privacy:** message text sent for translation is sent to a third-party service. Do not enable private-message translation unless you accept that. MyMemory has public usage limits.

## Status

Installable build produced by CI; **not yet a fully verified final release**. Please test on a non-sensitive public channel first. If the plugin fails to load or translations do not appear after scrolling away and back, check the Revenge logs and report the error.
