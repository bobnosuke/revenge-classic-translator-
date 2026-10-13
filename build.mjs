import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {rollup} from "rollup";
import esbuild from "rollup-plugin-esbuild";
const folder = "translator";
const manifest = JSON.parse(await readFile("plugins/"+folder+"/manifest.json","utf8"));
const out = "dist/"+folder;
await mkdir(out,{recursive:true});
const bundle = await rollup({
  input:"plugins/"+folder+"/src/index.ts",
  external:id=>id.startsWith("@vendetta"),
  plugins:[esbuild({target:"es2020",minify:true})],
  onwarn: warning => { if(warning.code!=="CIRCULAR_DEPENDENCY") console.warn(warning.message); }
});
await bundle.write({
  file:out+"/index.js",format:"iife",exports:"named",compact:true,
  globals:id=>id.startsWith("@vendetta")?id.substring(1).replace(/\//g,"."):id
});
await bundle.close();
const bytes=await readFile(out+"/index.js");
manifest.main="index.js";
manifest.hash=createHash("sha256").update(bytes).digest("hex");
await writeFile(out+"/manifest.json",JSON.stringify(manifest,null,2));
console.log("Built",out,"sha256",manifest.hash);
