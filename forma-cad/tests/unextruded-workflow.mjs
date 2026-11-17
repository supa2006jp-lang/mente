import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateFeature,validateProject} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {measureUnextrudedDimensions,formatUnextrudedDimensions} from '../src/unextruded-dimensions.js';
import {loadUnextrudedPreferences,saveUnextrudedPreferences,normalizeUnextrudedPreferences,unextrudedPreferenceKey} from '../src/unextruded-preferences.js';
let text=null;const storage=()=>({getItem:()=>text,setItem:(key,value)=>{assert.equal(key,unextrudedPreferenceKey);text=value;}});
assert.deepEqual(loadUnextrudedPreferences(storage),{version:1,enabled:true,last:null});
saveUnextrudedPreferences({version:1,enabled:true,last:{depth:-6,symmetric:false,operation:'join',target:'old-body'}},storage);
assert.deepEqual(loadUnextrudedPreferences(storage).last,{depth:-6,symmetric:false,operation:'join'});
assert(!text.includes('old-body'));
assert.equal(normalizeUnextrudedPreferences({version:1,enabled:false,last:{depth:-6,symmetric:true,operation:'new'}}).last.depth,6);
for(const last of [{depth:0,symmetric:false,operation:'new'},{depth:Infinity,symmetric:false,operation:'new'},{depth:3,symmetric:false,operation:'cut'}])assert.throws(()=>saveUnextrudedPreferences({version:1,enabled:true,last},storage));
text='{bad';assert.equal(loadUnextrudedPreferences(storage).last,null);
assert.equal(loadUnextrudedPreferences(()=>{throw Error('blocked');}).enabled,true);
assert.throws(()=>saveUnextrudedPreferences({version:1,enabled:true,last:null},()=>({setItem(){throw Error('full');}})),/保存/);

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'right',name:'右',kind:'extrusion',width:30,height:40,x:15,depth:10},other={...base,id:'left',name:'左',width:10,x:-25};
const region={id:'r',plane:'XY',offset:0,outer:[[-30,-20],[30,-20],[30,20],[-30,20]],holes:[],sourceIds:[],area:2400};
const f={...defaults,id:'added',name:'追加',kind:'extrusion',profile:'region',region,depth:6,unextrudedOnly:true,overlapOnly:true};
for(const [mode,targets,width,expected] of [['all',['right','left'],20,4800],['selected',['right'],30,7200]]){
 const feature={...f,unextrudedTargetMode:mode,overlapTargets:targets};validateFeature(feature);
 const result=runOperation([base,other],{type:'exactExtrusionPreview',features:[feature]}),output=result.features[0].cadResult.outputs[0];
 const dimensions=measureUnextrudedDimensions(feature,[output]);
 assert(Math.abs(dimensions.width-width)<.001);assert(Math.abs(dimensions.depth-40)<.001);assert(Math.abs(dimensions.height-6)<.001);
 assert.equal(formatUnextrudedDimensions([dimensions]),'追加部分：幅 '+width+' × 奥行 40 × 高さ 6 mm');
 const shape=R.deserializeShape(output.brep).asShape3D();try{assert(Math.abs(R.measureVolume(shape)-expected)<.01);}finally{shape.delete();}
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[base,other,...result.features]})));
 assert.equal(saved.at(-1).unextrudedTargetMode,mode);assert.deepEqual(saved.at(-1).overlapTargets,targets);
}
assert.throws(()=>validateFeature({...f,unextrudedTargetMode:'unknown',overlapTargets:['right']}));
assert.throws(()=>validateFeature({...f,unextrudedTargetMode:'selected',overlapTargets:[]}),/1つ以上/);
assert.equal(measureUnextrudedDimensions(f,[]),null);
console.log('PASS actual added dimensions, all/selected body masks, recipe persistence, missing-target rejection, preference defaults/validation/storage failures and reference-free settings');
