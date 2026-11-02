import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';
import {fittedPhotoSurface,photoSolidVolume} from '../src/reference-photo-solid.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),feature=(shape,id='body')=>({kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]});
const frame={u:[1,0,0],v:[0,1,0],n:[0,0,1]},settings={frame,offset:15,center:[130,70],width:152,height:76,angle:0,sourceAngle:0};
const box=R.makeBox([80,45,5],[160,95,15]),features=[feature(box)],snapshot=JSON.stringify(features),spec=p=>({type:'resize',id:crypto.randomUUID(),targets:['body'],factor:1,photoFit:p}),body=result=>R.deserializeShape(result.outputs[0].brep).asShape3D();
const result=runOperation(features,spec(settings)),next=body(result);let bounds=next.boundingBox;try{near(bounds.bounds[0][0],54);near(bounds.bounds[1][0],206);near(bounds.bounds[0][1],32);near(bounds.bounds[1][1],108);near(bounds.bounds[0][2],5);near(bounds.bounds[1][2],15);}finally{bounds.delete();}
near(photoSolidVolume(next),152*76*10);assert.ok(JSON.stringify(features)===snapshot,'source document unchanged');assert.ok(inspectCadStl(result.outputs[0]).report.ok);
const originalPhoto={surface:{bodyId:'body',outer:[[80,45],[160,45],[160,95],[80,95]],holes:[]}},updated=fittedPhotoSurface(originalPhoto,result.analysis.resize.photoFit);near(updated.surface.outer[0][0],54);near(updated.surface.outer[0][1],32);assert.equal(updated.surface.fittedAngle,0);
const rotated=runOperation(features,spec({...settings,angle:30})),rotatedBody=body(rotated),repeat=runOperation([feature(rotatedBody)],spec({...settings,angle:30,sourceAngle:30})),repeatBody=body(repeat);near(photoSolidVolume(rotatedBody),photoSolidVolume(repeatBody));const a=rotatedBody.cut(repeatBody),b=repeatBody.cut(rotatedBody);near(Math.abs(photoSolidVolume(a))+Math.abs(photoSolidVolume(b)),0);a.delete();b.delete();
const hole=R.makeCylinder(5,12,[120,70,4]),plate=box.cut(hole),holed=runOperation([feature(plate)],spec(settings)),holedBody=body(holed);near(photoSolidVolume(holedBody),(80*50-Math.PI*25)*10*(152/80)*(76/50));assert.ok(inspectCadStl(holed.outputs[0]).report.ok);
const cylinder=R.makeCylinder(10,8,[0,0,2]),ellipse=runOperation([feature(cylinder)],spec({...settings,offset:10,center:[3,-4],width:50,height:30})),ellipseBody=body(ellipse);near(photoSolidVolume(ellipseBody),Math.PI*25*15*8);assert.ok(inspectCadStl(ellipse.outputs[0]).report.ok);
const side=runOperation(features,spec({frame:{u:[1,0,0],v:[0,0,1],n:[0,-1,0]},offset:-45,center:[120,10],width:120,height:20,angle:0,sourceAngle:0})),sideBody=body(side);near(photoSolidVolume(sideBody),120*20*50);
const bottom=runOperation(features,spec({frame:{u:[1,0,0],v:[0,-1,0],n:[0,0,-1]},offset:-5,center:[120,-70],width:100,height:60,angle:0,sourceAngle:0})),bottomBody=body(bottom);near(photoSolidVolume(bottomBody),100*60*10);
const pocketTool=R.makeBox([100,55,10],[140,85,16]),pocket=box.cut(pocketTool);assert.throws(()=>runOperation([feature(pocket)],spec(settings)),/断面が変わる/);assert.throws(()=>runOperation(features,spec({...settings,width:0})),/写真/);assert.throws(()=>runOperation(features,spec({...settings,offset:14})),/平面/);assert.throws(()=>runOperation(features,{...spec(settings),targets:['missing']}),/選び直/);
const doc={format:'forma-cad',version:1,features:[...features,{kind:'cadop',id:'fit',name:'写真に合わせる',spec:spec(settings),...result}]};validateProject(doc);const reloaded=kernelBodies(doc.features);try{near(photoSolidVolume(reloaded.get('body')),152*76*10);}finally{reloaded.forEach(s=>s.delete());}
const replay=runOperation(doc.features,{type:'replay',before:doc.features,start:1,forceFull:true,refreshStart:true});assert.ok(replay.features.at(-1).outputs[0].brep);const replayed=kernelBodies(replay.features);try{near(photoSolidVolume(replayed.get('body')),152*76*10);}finally{replayed.forEach(s=>s.delete());}
for(const shape of [box,next,rotatedBody,repeatBody,hole,plate,holedBody,cylinder,ellipseBody,sideBody,bottomBody,pocketTool,pocket])shape.delete();
const proof={pass:true,exactSize:true,thicknessPreserved:true,centerAndAngle:true,idempotent:true,holesPreserved:true,circleToEllipse:true,sideAndBottomFaces:true,unsupportedShapeUnchanged:true,closedStl:true,reloadReplay:true};const out=process.env.FORMA_PHOTO_SOLID_OUT||'.sites-runtime/reference-photo-solid';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
