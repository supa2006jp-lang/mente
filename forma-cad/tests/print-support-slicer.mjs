import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
const exe=process.env.BAMBU_STUDIO_EXE||'C:/Program Files/Bambu Studio/bambu-studio.exe',root=path.resolve('.sites-runtime/support-slicing');
// prepare-support-slicing writes native before.stl and flattened, local test-only
// A1 mini / PLA profiles. These profiles are never packaged into the CAD export.
execFileSync(process.execPath,['tests/print-support-model-base.mjs'],{stdio:'pipe'});execFileSync(process.execPath,['tests/print-support-slicer-fixture.mjs'],{stdio:'pipe'});execFileSync(process.execPath,['tests/print-support-walls.mjs'],{stdio:'pipe'});
const report={layerHeight:.3,slicer:'Bambu Studio 02.04.00.70',checkedAt:new Date().toISOString(),cases:[]};
function printedTieLayers(gcode,model){
 const m=model.match(/<item[^>]*transform="([^"]+)"/)?.[1].trim().split(/\s+/).map(Number);assert.equal(m?.length,12);const levels=new Set(),det=m[0]*m[4]-m[3]*m[1];let x=0,y=0,z=0,height=0;
 const native=(x,y)=>[(m[4]*(x-m[9])-m[3]*(y-m[10]))/det,(-m[1]*(x-m[9])+m[0]*(y-m[10]))/det];
 for(const line of gcode.split(/\r?\n/)){if(line.startsWith('; Z_HEIGHT:'))height=Number(line.split(':')[1]);if(!/^G[0123]\s/.test(line))continue;const values=Object.fromEntries([...line.matchAll(/(?:^|\s)([XYZE])(-?[\d.]+)/g)].map(v=>[v[1],Number(v[2])])),nx=values.X??x,ny=values.Y??y,nz=values.Z??z;
  if(/^G1\s/.test(line)&&values.E>0&&(values.X!==undefined||values.Y!==undefined)&&height>5&&height<49&&Math.abs(nz-height)<.001){const [u,v]=native((x+nx)/2,(y+ny)/2);if(u>3.45&&u<5.25&&v>9.45&&v<10.9)levels.add(height);}
  x=nx;y=ny;z=nz;
 }
 return [...levels].sort((a,b)=>a-b);
}
for(const name of ['before','walls',...(await fs.access(path.join(root,'ui-walls.3mf')).then(()=>['ui-walls'],()=>[]))]){
 const outputdir=path.join(root,name+'-verified');await fs.mkdir(outputdir,{recursive:true});
 execFileSync(exe,['--debug','1','--load-settings',path.join(root,'machine.json')+';'+path.join(root,'process.json'),'--load-filaments',path.join(root,'filament.json'),'--arrange','1','--orient','0','--slice','0','--export-3mf',name+'.3mf','--outputdir',outputdir,path.join(root,name+(name==='before'?'.stl':'.3mf'))],{stdio:'pipe',timeout:120000});
 const zip=unzipSync(await fs.readFile(path.join(outputdir,name+'.3mf'))),gcode=strFromU8(zip['Metadata/plate_1.gcode']),profile=JSON.parse(strFromU8(zip['Metadata/project_settings.config'])),config=strFromU8(zip['Metadata/model_settings.config']);
 assert.equal(String(profile.enable_support),'1');assert.equal(String(profile.layer_height),'0.3');const supports=(gcode.match(/^; FEATURE: Support(?: interface)?\r?$/gm)||[]).length;assert(gcode.includes('; FEATURE: Bridge'));if(name==='before')assert(supports>0);else{assert.equal(supports,0,'no extra auto support paths with global support enabled');assert.match(config,/subtype="support_blocker"/);assert.match(config,/key="layer_height" value="0.3"/);}
 const tieExtrusionLayers=name==='before'?[]:printedTieLayers(gcode,strFromU8(zip['3D/3dmodel.model']));if(name!=='before'){assert(tieExtrusionLayers.some(z=>z>24&&z<27),'first tie level has real extrusion between fins');assert(tieExtrusionLayers.some(z=>z>44&&z<47),'second tie level has real extrusion between fins');}
 report.cases.push({name,autoSupportEnabled:true,supportFeatureSections:supports,tieExtrusionLayers,estimatedTime:gcode.match(/^; total estimated time: (.+)$/m)?.[1]});
}
report.pass=true;await fs.writeFile('.sites-runtime/print-support-slicer-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
