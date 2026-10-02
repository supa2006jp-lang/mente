import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {zipSync} from 'three/addons/libs/fflate.module.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const siteOnly=process.argv.includes('--site-only');
const entries=Object.create(null);
for(const relative of new Set(files)){
 if(siteOnly&&relative!=='index.html'&&!relative.startsWith('dist/'))continue;
 if(relative.split('/').some(part=>['.git','node_modules','.sites-runtime'].includes(part))||/(^|\/)\.env(?:\.|$)/.test(relative)&&!relative.endsWith('.env.example')||relative.endsWith('.zip'))continue;
 const full=path.resolve(root,relative),inside=path.relative(root,full);
 if(inside.startsWith('..')||path.isAbsolute(inside))throw Error('Invalid archive path');
 const stat=await fs.lstat(full).catch(()=>null);
 if(!stat?.isFile()||stat.isSymbolicLink())continue;
 entries[(siteOnly?'forma-cad/':'')+relative.replaceAll('\\','/')]=new Uint8Array(await fs.readFile(full));
}
for(const required of (siteOnly?['forma-cad/index.html','forma-cad/dist/index.html','forma-cad/dist/replicad_single.wasm']:['.github/workflows/pages.yml','dist/index.html','dist/replicad_single.wasm','package-lock.json','src/sketch-midpoints.js']))if(!entries[required])throw Error('Missing '+required);
const output=path.join(root,'.sites-runtime',siteOnly?'forma-cad-github-site.zip':'forma-cad-github.zip');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,zipSync(entries,{level:6}));
console.log('GitHub upload ZIP: '+output+' ('+Object.keys(entries).length+' files)');
