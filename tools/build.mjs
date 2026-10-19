import {build} from 'esbuild';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=await build({entryPoints:[path.join(root,'web/app.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'inline',write:false});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'web/style.css'),'utf8');
const data=JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'desk_scene.json'),'utf8'))).replaceAll('<','\\u003c');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const own=fs.readFileSync(path.join(root,'LICENSE'),'utf8'),three=fs.readFileSync(path.join(root,'node_modules/three/LICENSE'),'utf8');
html=html.replace('<link rel="stylesheet" href="web/style.css">',()=>'<style>'+css+'</style>')
  .replace(/<script type="importmap">[\s\S]*?<\/script>/,'')
  .replace('<script type="module" src="web/app.mjs"></script>',()=>'<script id="scene-data" type="application/json">'+data+'</script><script>'+script+'</script>')
  .replace('<footer>',()=>'<details><summary>Source and third-party licenses</summary><pre style="white-space:pre-wrap;font-size:11px">'+escape(own+'\n\nThree.js\n'+three)+'</pre></details><footer>');
fs.writeFileSync(path.join(root,'desk_racer.html'),html);
console.log(`Built self-contained desk_racer.html (${Buffer.byteLength(html)} bytes)`);
