import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {nativeSketchFeature,nativeRingSegments} from '../src/native-sketch-arcs.js';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';
import {resolveFilletEdges} from '../src/solid-fillet.js';
import {acceptedFilletSpec} from '../src/fillet-partial-confirm.js';
import {legacyArcBody} from '../src/legacy-arc-body.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
function sketches({plane='XY',frame,tag=true,radius=20,prefix=''}={}){
 const f=(id,points,arc=false)=>({...defaults,id:prefix+id,name:id,kind:'sketch',profile:'polyline',plane,...(frame?{frame}:{}),points,closed:false,...(tag&&arc?{arc:{endTangent:[1,0]}}:{})});
 return [f('bottom',[[-30,-radius],[30,-radius]]),f('right',Array.from({length:65},(_,i)=>[30+radius*Math.cos(-Math.PI/2+i*Math.PI/64),radius*Math.sin(-Math.PI/2+i*Math.PI/64)]),true),f('top',[[30,radius],[-30,radius]]),f('left',Array.from({length:65},(_,i)=>[-30+radius*Math.cos(Math.PI/2+i*Math.PI/64),radius*Math.sin(Math.PI/2+i*Math.PI/64)]),true)];
}
const data=sketches(),region=findRegions(data)[0],feature={...defaults,id:'body',name:'カプセル',kind:'extrusion',profile:'region',region,depth:50},source=JSON.stringify(data),recovered=nativeSketchFeature(feature,data);
assert.notEqual(recovered,feature);assert.equal(JSON.stringify(data),source);assert.equal(feature.region._nativeArcSources,undefined);
for(const ring of [region.outer,[...region.outer].reverse(),[...region.outer.slice(17),...region.outer.slice(0,17)]]){
 const segments=nativeRingSegments(ring,recovered.region._nativeArcSources);assert.equal(segments.length,4);assert.equal(segments.filter(s=>s.via).length,2);
}
const count=shape=>{const faces=shape.faces;try{return faces.length;}finally{faces.forEach(f=>f.delete());}};
const legacy=featureSolid(feature),modernResult=runOperation(data,{type:'extrusion',feature}),modern=R.deserializeShape(modernResult.outputs[0].brep).asShape3D();
assert.equal(count(legacy),132);assert.equal(count(modern),6);near(R.measureVolume(modern),(60*40+Math.PI*400)*50);
const sharp=resolveFilletEdges(modern);try{assert.equal(sharp.length,8,'tessellation columns must not become fillet candidates');}finally{sharp.forEach(edge=>edge.delete());}
for(const plane of ['XZ','YZ']){
 const ss=sketches({plane}),f={...feature,plane,region:findRegions(ss)[0],depth:-12},result=runOperation(ss,{type:'extrusion',feature:f}),body=R.deserializeShape(result.outputs[0].brep).asShape3D();try{assert.equal(count(body),6);near(R.measureVolume(body),(60*40+Math.PI*400)*12);}finally{body.delete();}
}
const untagged=sketches({tag:false}),intentional=runOperation(untagged,{type:'extrusion',feature:{...feature,region:findRegions(untagged)[0]}}),polygon=R.deserializeShape(intentional.outputs[0].brep).asShape3D();try{assert.equal(count(polygon),132);near(R.measureVolume(polygon),R.measureVolume(legacy));}finally{polygon.delete();}
const cachedPolygon=kernelBodies([...untagged,feature]),cachedArcs=kernelBodies([...data,feature]);try{assert.equal(count(cachedPolygon.get('body')),132);assert.equal(count(cachedArcs.get('body')),6,'body cache includes the source arc recipe, even when region points and IDs are unchanged');}finally{for(const body of [...cachedPolygon.values(),...cachedArcs.values()])body.delete();}
const thin=runOperation(data,{type:'extrusion',feature:{...feature,mode:'thin',wall:2,side:'inside'}}),thinShape=R.deserializeShape(thin.outputs[0].brep).asShape3D();try{assert.equal(count(thinShape),10);near(R.measureVolume(thinShape),((60*40+Math.PI*400)-(60*36+Math.PI*324))*50);}finally{thinShape.delete();}
for(const side of ['outside','center']){const out=side==='outside'?22:21,inside=side==='outside'?20:19,result=runOperation(data,{type:'extrusion',feature:{...feature,mode:'thin',wall:2,side}}),body=R.deserializeShape(result.outputs[0].brep).asShape3D();try{assert.equal(count(body),10);near(R.measureVolume(body),(120*(out-inside)+Math.PI*(out**2-inside**2))*50);}finally{body.delete();}}
const hole={...defaults,id:'hole',name:'穴',kind:'sketch',profile:'circle',diameter:8},withHole=[...data,hole],holeRegion=findRegions(withHole).find(r=>r.holes.length),holeBodyResult=runOperation(withHole,{type:'extrusion',feature:{...feature,region:holeRegion}}),holeBody=R.deserializeShape(holeBodyResult.outputs[0].brep).asShape3D();try{assert.equal(count(holeBody),7);near(R.measureVolume(holeBody),(60*40+Math.PI*400-Math.PI*16)*50);}finally{holeBody.delete();}
const ellipse=sketches().map(f=>({...f,points:f.points.map(([x,y])=>[x,y*1.2])}));assert.equal(nativeSketchFeature({...feature,region:findRegions(ellipse)[0]},ellipse).region._nativeArcSources,undefined,'an arc tag alone must not circularize an elliptical curve');
const circle={...defaults,id:'circle',name:'円',kind:'sketch',profile:'circle',diameter:60},cutLine={...defaults,id:'chord',name:'弦',kind:'sketch',profile:'polyline',points:[[30,0],[30*Math.cos(Math.PI/8),30*Math.sin(Math.PI/8)]],closed:false},capSketches=[circle,cutLine],capRegion=findRegions(capSketches).sort((a,b)=>a.area-b.area)[0],cap=runOperation(capSketches,{type:'extrusion',feature:{...feature,region:capRegion,depth:10}}),capBody=R.deserializeShape(cap.outputs[0].brep).asShape3D();try{assert.equal(count(capBody),4,'a closing chord stays straight instead of being mistaken for an arc');near(R.measureVolume(capBody),450*(Math.PI/8-Math.sin(Math.PI/8))*10);}finally{capBody.delete();}

const history=[...data,{...feature,cadResult:{outputs:[{id:'body',brep:legacy.serialize(),...legacy.mesh()}],remove:[]}}],shellSpec={type:'shell',target:'body',id:'shell',thickness:2,direction:'内側',faces:[{bodyId:'body',point:[0,0,50],normal:[0,0,1]}]},shell=runOperation(history,shellSpec),saved=[...history,{kind:'cadop',id:'shell',name:'シェル',spec:shellSpec,...shell}],snapshot=JSON.stringify(saved),start=performance.now();
const rounded=runOperation(saved,{type:'fillet',target:'body',id:'round',radius:.5,partialMode:'offer'});
assert.equal(rounded.analysis.partialFillet,undefined,'the restored shell rounds directly without searching individual facet combinations');assert.equal(rounded.analysis.fillets[0].edges,16);assert.equal(rounded.analysis.fillets[0].arcRecovery.beforeFaces,263);assert.equal(rounded.analysis.fillets[0].arcRecovery.afterFaces,11);
const nativeHistory=[...data,{...feature,cadResult:modernResult}],nativeShell=runOperation(nativeHistory,shellSpec),nativeSaved=[...nativeHistory,{kind:'cadop',id:'shell',name:'シェル',spec:shellSpec,...nativeShell}],single=runOperation(saved,{type:'fillet',target:'body',radius:.5,edges:[{bodyId:'body',point:[50,0,50]}]}),wholeRim=runOperation(nativeSaved,{type:'fillet',target:'body',radius:.5,edges:[[0,-20,50],[50,0,50],[0,20,50],[-50,0,50]].map(point=>({bodyId:'body',point}))}),singleShape=R.deserializeShape(single.outputs[0].brep).asShape3D(),rimShape=R.deserializeShape(wholeRim.outputs[0].brep).asShape3D();
try{assert.equal(single.analysis.fillets[0].edges,1);near(R.measureVolume(singleShape),R.measureVolume(rimShape));assert.ok(single.analysis.fillets[0].arcRecovery,'one picked rim edge propagates across tangent arcs and straight sections, including legacy geometry');}finally{singleShape.delete();rimShape.delete();}
const partial=runOperation(saved,{type:'fillet',target:'body',id:'partial',radius:2,partialMode:'offer'});
assert.equal(partial.analysis.partialFillet.accepted+partial.analysis.partialFillet.skipped+partial.analysis.partialFillet.untested,16);
assert.ok(partial.analysis.partialFillet.rejected.every(edge=>edge.points.every(point=>Math.abs(point[2]-edge.points[0][2])<1e-6)),'rejected-edge colouring contains genuine rims, never the hundreds of vertical facet seams');
const replaySpec=acceptedFilletSpec({type:'fillet',target:'body',id:'again',radius:2,partialMode:'offer'},partial.analysis.partialFillet),replay=runOperation(saved,replaySpec),a=R.deserializeShape(partial.outputs[0].brep).asShape3D(),b=R.deserializeShape(replay.outputs[0].brep).asShape3D();try{near(R.measureVolume(a),R.measureVolume(b));}finally{a.delete();b.delete();}
assert.equal(JSON.stringify(saved),snapshot);validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[...saved,{kind:'cadop',id:'again',name:'フィレット',spec:replaySpec,...replay}]})));
assert.ok(!JSON.stringify([...saved,rounded]).includes('_nativeArcSources'),'temporary recovery hints never increase saved-file payload');
const movedSpec={type:'move',target:'body',id:'move',x:30,y:-15,z:5,rotation:[25,10,-20],pivot:[0,0,0]},moved=runOperation(saved,movedSpec),movedHistory=[...saved,{kind:'cadop',id:'move',name:'移動',spec:movedSpec,...moved}],movedRound=runOperation(movedHistory,{type:'fillet',target:'body',id:'moved-round',radius:.5}),m=R.deserializeShape(movedRound.outputs[0].brep).asShape3D(),n=R.deserializeShape(rounded.outputs[0].brep).asShape3D();try{assert.ok(movedRound.analysis.fillets[0].arcRecovery);near(R.measureVolume(m),R.measureVolume(n));}finally{m.delete();n.delete();}
const altered=legacy.clone().translate([1,0,0]);try{assert.equal(legacyArcBody(history,'body',altered,{makeSolid:featureSolid,run:runOperation}),null,'a stored body that does not match its recipe is never replaced');assert.equal(legacyArcBody([{kind:'cadop',id:'import',outputs:history.at(-1).cadResult.outputs,remove:[]}],'body',legacy,{makeSolid:featureSolid,run:runOperation}),null,'imported geometry without its sketch history is not guessed');assert.equal(legacyArcBody([...history,{kind:'cadop',spec:{type:'join',target:'body'},outputs:history.at(-1).cadResult.outputs,remove:[]}],'body',legacy,{makeSolid:()=>{throw Error('must not rebuild unsupported joins');},run:runOperation}),null);}finally{altered.delete();}
console.log(JSON.stringify({legacyFaces:263,recoveredFaces:11,filletEdges:16,legacyRoundMs:Math.round(performance.now()-start)}));
legacy.delete();modern.delete();console.log('PASS native mixed arc/line extrusion, reversed/ring-start topology, other planes, intentional polygon guard, thin walls, saved-shell recovery, direct fillet, limited diagnostic rims, replay and unchanged source history');
