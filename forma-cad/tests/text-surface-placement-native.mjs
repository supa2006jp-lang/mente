import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {textSurfacePlacement,textMoveToSurface} from '../src/text-surface-placement.js';
import {parseTextFont,textSketchLayout,textSketchFeatures} from '../src/text-sketch.js';
import {findRegions} from '../src/regions.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {outwardExtrusion} from '../src/extrusion-direction.js';
import {basisFor} from '../src/frames.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const fontData=await fs.readFile('assets/fonts/NotoSansCJKjp-Regular.otf'),font=parseTextFont(fontData.buffer.slice(fontData.byteOffset,fontData.byteOffset+fontData.byteLength)),reference={u:[1,0,0],v:[0,1,0],n:[0,0,1]};
function check(bodies,expected){assert.equal(bodies.size,1);const shape=[...bodies.values()][0],analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert(analyzer.IsValid());assert(Math.abs(R.measureVolume(shape)-expected)<.003);}finally{analyzer.delete();bodies.forEach(s=>s.delete());}}
const base={...defaults,id:'plate',name:'土台',kind:'extrusion',width:80,height:50,depth:10},mesh=new THREE.Mesh(new THREE.BoxGeometry(80,50,10),new THREE.MeshBasicMaterial());mesh.position.z=5;mesh.userData.bodyId='plate';mesh.updateMatrixWorld(true);
for(const [index,origin,direction] of [[0,[0,0,100],[0,0,-1]],[1,[0,-100,5],[0,1,0]]]){
 const hit=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction)).intersectObject(mesh)[0],surface=textSurfacePlacement(hit,reference);assert(surface);const initial=textSketchLayout(font,{text:'O',height:4,angle:20}),position=textMoveToSurface(initial,surface),layout=textSketchLayout(font,{text:'O',angle:20,...position}),placement=surface.placement,sketches=textSketchFeatures(layout,placement),regions=findRegions(sketches);assert.equal(regions.length,1);assert.equal(regions[0].holes.length,1);
 for(const [operation,depth] of [['cut',-1],['join',1]]){const features=regions.map((region,i)=>{region=outwardExtrusion({...defaults,profile:'region',region,plane:region.plane,frame:region.frame},new Map([['plate',mesh]])).region;const n=basisFor(region).n;return {...defaults,id:'text-'+index+'-'+operation+'-'+i,kind:'extrusion',profile:'region',region,plane:region.plane,frame:region.frame,x:n.x*region.offset,y:n.y*region.offset,z:n.z*region.offset,depth,operation,target:'plate'};}),history=[base,...sketches,...runOperation([base,...sketches],{type:'extrusionBatch',features}).features];check(kernelBodies(history),40000+(operation==='cut'?-1:1)*regions[0].area);}
}
const browserDoc=JSON.parse(await fs.readFile('outputs/text-surface-placement/engraved.forma.json','utf8')),cut=browserDoc.features.at(-1);check(kernelBodies(browserDoc.features),40000-cut.region.area);mesh.geometry.dispose();mesh.material.dispose();
const proof={topSurfaceCut:true,sideSurfaceCut:true,topSurfaceRaisedText:true,sideSurfaceRaisedText:true,exactInkVolume:true,counterHolePreserved:true,browserResultHasCorrectVolume:true,validSolids:true};await fs.writeFile('outputs/text-surface-placement/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
