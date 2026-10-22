import {runOperation} from '../src/kernel.js';
import {cadMesh} from '../src/cad-mesh.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {inspectGeometryHealth,inspectShapeHealth,healthBudget} from '../src/geometry-health.js';
import {MODEL_PRECISION as P,BOOLEAN_TOLERANCES,isContactDistance} from '../src/model-precision.js';
import {fuseSolids} from '../src/solid-fuse.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const owned=[],own=s=>(owned.push(s),s),box=(a,b)=>own(R.makeBox(a,b)),base=box([0,0,0],[20,20,10]);
try{
 assert(isContactDistance(P.contact));assert(!isContactDistance(P.contact*1.01));assert.deepEqual(BOOLEAN_TOLERANCES,[0,P.contact]);
 let result=inspectGeometryHealth(new Map([['body',base]]),{threshold:.01});assert.equal(result.findings,0);assert.equal(result.partial,false);
 const tiny=box([25,0,0],[25.002,10,.002]),compound=own(R.makeCompound([base.clone(),tiny.clone()]));result=inspectGeometryHealth(new Map([['body',compound]]),{threshold:.01});assert(result.rows[0].findings.some(f=>f.code==='disconnected'));assert(result.rows[0].findings.some(f=>f.code==='small-component'));assert(result.rows[0].findings.some(f=>f.code==='narrow-face'));assert(result.rows[0].findings.some(f=>f.code==='short-edge'));
 const near=box([20.005,0,0],[30,20,10]);result=inspectGeometryHealth(new Map([['a',base],['b',near]]),{threshold:.01});assert(result.rows[0].findings.some(f=>f.code==='micro-gap'&&Math.abs(f.size-.005)<1e-8));
 const slotTool=box([9.9975,-1,2],[10.0025,21,11]),slot=own(base.cut(slotTool));result=inspectGeometryHealth(new Map([['slot',slot]]),{threshold:.01});assert(result.rows[0].findings.some(f=>f.code==='micro-gap'&&Math.abs(f.size-.005)<1e-8),'narrow internal void detected');
 const wall=box([0,0,0],[20,.005,10]);result=inspectGeometryHealth(new Map([['wall',wall]]),{threshold:.01});assert(!result.rows[0].findings.some(f=>f.code==='micro-gap'),'thin material is not labelled a void');assert(result.findings>0,'thin intentional wall is only reported, never removed');
 const far=box([21,0,0],[30,20,10]);result=inspectGeometryHealth(new Map([['a',base],['b',far]]),{threshold:.01});assert(!result.rows.some(r=>r.findings.some(f=>f.code==='micro-gap')));
 const budget=healthBudget();budget.faces=0;const partial=inspectShapeHealth(slot,{id:'slot',budget});assert(partial.partial,'budget-limited check cannot claim complete');
 const volume=R.measureVolume(compound),snapshot=compound.serialize();inspectGeometryHealth(new Map([['body',compound]]),{threshold:.01});assert.equal(compound.serialize(),snapshot);assert.equal(R.measureVolume(compound),volume);
 const touching=box([20,0,0],[30,20,10]),joined=own(fuseSolids([base,touching]));{const parts=joined.solids;try{assert.equal(parts.length,1);}finally{parts.forEach(p=>p.delete());}}const separated=own(fuseSolids([base,near]));{const parts=separated.solids;try{assert.equal(parts.length,2,'common contact policy does not bridge a real .005mm gap');}finally{parts.forEach(p=>p.delete());}}
 const nativeOutput=(shape,id)=>({id,...cadMesh(shape),cadCoordinatePrecision:true,brep:shape.serialize()});
 const rod=box([19.999,1,1],[25,1.002,1.002]),initial=[{kind:'cadop',id:'a',name:'検査用の板',outputs:[nativeOutput(base,'a'),nativeOutput(rod,'rod')],remove:[]}],joinSpec={type:'join',id:'join',target:'a',other:'rod',combineMode:'結合'},operation=runOperation(initial,joinSpec);assert(operation.analysis.geometryHealth.rows[0].findings.some(f=>f.code==='narrow-face'));assert(operation.analysis.geometryHealth.rows[0].before.volume<operation.analysis.geometryHealth.rows[0].after.volume);
 for(const [gap,count]of [[.5e-6,1],[1.1e-6,2],[.005,2]]){const target=box([20+gap,0,0],[30,20,10]),combined=own(fuseSolids([base,target])),parts=combined.solids;try{assert.equal(parts.length,count,'shared distance and fuzzy join threshold');}finally{parts.forEach(p=>p.delete());}}
 const dir='outputs/geometry-health/';await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'automatic.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[...initial,{kind:'cadop',id:'join',name:'結合',spec:joinSpec,...operation}]}));await fs.writeFile(dir+'gap.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[{kind:'cadop',id:'a',name:'板',outputs:[nativeOutput(base,'a'),nativeOutput(near,'b')],remove:[]}]}));await fs.writeFile(dir+'native-proof.json',JSON.stringify({normalClean:true,tinyRod:true,narrowFace:true,shortEdge:true,externalGap:true,internalSlot:true,thinWallNotVoid:true,realGapPreserved:true,partialHonest:true,unchangedShape:true},null,2));
 console.log('PASS normal/tiny rods, narrow faces, short edges, native inner/outer gaps, thin wall classification, bounded inspection, immutable geometry and shared boolean tolerance');
}finally{owned.reverse().forEach(s=>s.delete());}
