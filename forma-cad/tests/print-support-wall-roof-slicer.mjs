import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
const root=path.resolve('.sites-runtime/support-slicing'),cases=[];
function roofLayers(gcode,model){
 const m=model.match(/<item[^>]*transform="([^"]+)"/)?.[1].trim().split(/\s+/).map(Number);assert.equal(m?.length,12);const det=m[0]*m[4]-m[3]*m[1],levels=new Set();let x=0,y=0,z=0,height=0;
 for(const line of gcode.split(/\r?\n/)){
  if(line.startsWith('; Z_HEIGHT:'))height=Number(line.split(':')[1]);if(!/^G[01]\s/.test(line))continue;const values=Object.fromEntries([...line.matchAll(/(?:^|\s)([XYZE])(-?[\d.]+)/g)].map(v=>[v[1],Number(v[2])])),nx=values.X??x,ny=values.Y??y,nz=values.Z??z;
  if(/^G1\s/.test(line)&&values.E>0&&(values.X!==undefined||values.Y!==undefined)&&height>48.8&&height<50&&Math.abs(nz-height)<.001){const dx=(x+nx)/2-m[9],dy=(y+ny)/2-m[10],u=(m[4]*dx-m[3]*dy)/det,v=(-m[1]*dx+m[0]*dy)/det;if(u>18&&u<26&&v>12&&v<18)levels.add(height);}
  x=nx;y=ny;z=nz;
 }
 return [...levels].sort((a,b)=>a-b);
}
for(const name of ['roof','roof-windows',...(await fs.access(path.join(root,'ui-roof.3mf')).then(()=>['ui-roof'],()=>[]))]){
 const outputdir=path.join(root,name+'-verified');await fs.mkdir(outputdir,{recursive:true});execFileSync(process.env.BAMBU_STUDIO_EXE||'C:/Program Files/Bambu Studio/bambu-studio.exe',['--debug','1','--load-settings',path.join(root,'machine.json')+';'+path.join(root,'process.json'),'--load-filaments',path.join(root,'filament.json'),'--arrange','1','--orient','0','--slice','0','--export-3mf',name+'.3mf','--outputdir',outputdir,path.join(root,name+'.3mf')],{stdio:'pipe',timeout:120000});
 const zip=unzipSync(await fs.readFile(path.join(outputdir,name+'.3mf'))),gcode=strFromU8(zip['Metadata/plate_1.gcode']),profile=JSON.parse(strFromU8(zip['Metadata/project_settings.config']));assert.equal(String(profile.enable_support),'1');assert.equal(String(profile.layer_height),'0.3');const supports=(gcode.match(/^; FEATURE: Support(?: interface)?\r?$/gm)||[]).length,layers=roofLayers(gcode,strFromU8(zip['3D/3dmodel.model']));assert.equal(supports,0,'no duplicate auto supports');assert.equal(layers.length,name==='ui-roof'?3:2,'roof layers extrude between fins');for(let i=1;i<layers.length;i++)assert(Math.abs(layers[i]-layers[i-1]-.3)<1e-6);cases.push({name,autoSupportEnabled:true,supportFeatureSections:supports,layerHeight:.3,roofExtrusionLayers:layers});
}
const proof={pass:true,checkedAt:new Date().toISOString(),cases,physicalPrintTested:false};await fs.writeFile('.sites-runtime/print-support-roof-slicer-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
