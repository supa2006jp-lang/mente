import fs from 'node:fs/promises';
import path from 'node:path';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {printSupportDefaults} from '../src/print-support.js';
import {createPreciseStl} from '../src/stl-export-mesh.js';
const dir='.sites-runtime/support-slicing';await fs.mkdir(dir,{recursive:true});
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const doc=JSON.parse(await fs.readFile('.sites-runtime/print-support-model-base-fixture.forma.json','utf8')),spec={...printSupportDefaults,type:'printSupport',id:'supports',target:'channel'},out=runOperation(doc.features,spec),bodies=[...doc.features.flatMap(f=>f.outputs),...out.outputs];
const data=await createPreciseStl(bodies,async(f,s)=>runOperation(f,s));await fs.writeFile(path.join(dir,'before.stl'),Buffer.from(data.buffer,data.byteOffset,data.byteLength));
const profiles='C:/Program Files/Bambu Studio/resources/profiles/BBL';
async function preset(type,name){const data=JSON.parse(await fs.readFile(path.join(profiles,type,name+'.json'),'utf8'));let parent={};if(data.inherits)parent=await preset(type,data.inherits);const out={...parent,...data};delete out.inherits;return out;}
const machine=await preset('machine','Bambu Lab A1 mini 0.4 nozzle'),process=await preset('process','0.20mm Standard @BBL A1M'),filament=await preset('filament','Bambu PLA Basic @BBL A1M');
Object.assign(process,{layer_height:'0.3',initial_layer_print_height:'0.3',enable_support:'1',support_type:'tree(auto)',support_threshold_angle:'30'});machine.max_layer_height=['0.3'];
for(const [name,p]of Object.entries({machine,process,filament}))await fs.writeFile(path.join(dir,name+'.json'),JSON.stringify(p,null,2));console.log('Prepared baseline STL and 0.3 mm test profiles');
