import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url)),all=process.argv.includes('--all');
const representative=[
 'extrusion-multibody.mjs','extrusion-taper.mjs','extrusion-barrier-cache.mjs','cut-options.mjs','cut-no-overlap.mjs','holes-only.mjs',
 'solid-fillet.mjs','solid-chamfer.mjs','internal-curved-pull.mjs','shell.mjs','shell-revolved-sweep.mjs',
 'move-copy-kernel.mjs','move-until-contact.test.mjs','solid-mirror-tools.mjs','revolve.mjs','revolved-cut.mjs','revolved-body-join.mjs','joined-revolution-section.mjs',
 'trim-surface.mjs','trim-interior.mjs','pipe-mixed-path.mjs','shell-circular-loft.mjs','pattern-join.mjs','rectangular-pattern.mjs',
 'enclose.mjs','honeycomb.mjs','storage-tray-performance.mjs','boss-joint.mjs','simple-boss.mjs','ball-joint.mjs','cylinder-hinge.mjs','coil-joint.mjs',
 'snap-lid.mjs','slide-lid.mjs','qr-code-solid.mjs','surface-pattern-solid.mjs','internal-thread.mjs','print-support-walls.mjs','print-support-multiple-faces.mjs',
 'assembly-mate.mjs','print-layout-solid.mjs','drawing-auto-layout.mjs','drawing-auto-dimensions.mjs','dimension-measure-direct.mjs',
 'sketch-contact-shapes.mjs','sketch-motion-constraints.mjs','sketch-mirror.mjs','sketch-offset-closure.mjs','sketch-vertex-rotation-native.mjs',
 'text-edit-tools-native.mjs','text-bold-native.mjs','reference-trace-workflow.mjs','selection-library.mjs','step-import.mjs','kernel-integration.mjs',
 'part-workshop.mjs','fillet-radius-search.mjs','delete-fragment.mjs','svg-wrap.mjs','interior-edge-selection.mjs','thin-outer-wall.mjs','thread-fit.mjs'
];
const files=[],excluded=[];
for(const name of (all?await fs.readdir(path.join(root,'tests')):representative)){
 if(!/\.(mjs|test\.js)$/.test(name)||name.startsWith('.'))continue;
 const source=await fs.readFile(path.join(root,'tests',name),'utf8');
 if(!/from ['"]node:assert|from ['"]assert/.test(source)||/from ['"]playwright|require\(['"]playwright/.test(source))continue;
 if(/bambu-studio\.exe|Bambu Studio\/bambu/i.test(source)){excluded.push({name,reason:'Requires the external Bambu Studio slicer'});continue;}
 files.push(name);
}
if(process.argv.includes('--list')){console.log(JSON.stringify({files,excluded},null,2));process.exit(0);}
const runId=new Date().toISOString().replace(/[:.]/g,'-'),output=path.join(root,'.sites-runtime','command-checks',runId),results=[];
await fs.mkdir(output,{recursive:true});
let next=0,write=Promise.resolve();
function snapshot(){const report=JSON.stringify({runId,all,total:files.length,completed:results.length,excluded,results},null,2);write=write.then(()=>fs.writeFile(path.join(output,'results.json'),report));return write;}
async function worker(){while(next<files.length){
 const name=files[next++],start=Date.now(),chunks=[],child=spawn(process.execPath,[path.join('tests',name)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));let timedOut=false;
 // Some files run many independent native cases. This is a suite limit, not
 // the app's per-command timeout; a truncated suite must never count as passed.
 const timer=setTimeout(()=>{timedOut=true;child.kill();},900000);
 const code=await new Promise(resolve=>{child.on('error',e=>{chunks.push(Buffer.from(e.message));resolve(-1);});child.on('exit',resolve);});clearTimeout(timer);
 await fs.writeFile(path.join(output,name+'.log'),Buffer.concat(chunks));
 const result={name,status:timedOut?'timeout':code===0?'passed':'failed',elapsedMs:Date.now()-start,exitCode:code};results.push(result);await snapshot();console.log(`${results.length}/${files.length} ${result.status} ${name}`);
}}
await snapshot();await Promise.all([worker(),worker()]);await write;
const failed=results.filter(r=>r.status!=='passed');console.log(`${results.length-failed.length}/${results.length} passed. Logs: ${output}`);if(failed.length)process.exitCode=1;
