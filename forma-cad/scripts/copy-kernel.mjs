import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
await fs.copyFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm','dist/replicad_single.wasm');
// Version the UI, styling and worker together so cached releases cannot mix.
const bytes=await Promise.all(['dist/app.js','dist/kernel-worker.js','dist/style.css'].map(p=>fs.readFile(p)));
const version=createHash('sha256').update(Buffer.concat(bytes)).digest('hex').slice(0,12);
const html=await fs.readFile('dist/index.html','utf8');
const updated=html.replace(/href="style\.css(?:\?[^\"]*)?"/,'href="style.css?v='+version+'"').replace(/src="app\.js(?:\?[^\"]*)?"/,'src="app.js?v='+version+'"');
if(updated===html&&!html.includes('app.js?v='+version))throw Error('Missing application asset references');
await fs.writeFile('dist/index.html',updated);
console.log('Versioned application assets: '+version);
