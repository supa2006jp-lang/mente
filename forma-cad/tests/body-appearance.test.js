import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {strFromU8,unzipSync} from 'three/addons/libs/fflate.module.js';
import {bodyAppearances,bodyMaterialOptions,faceColorsByBody,importBodyAppearance,inheritBodyColors,setBodyColor,setBodyFaceColor} from '../src/body-appearance.js';
import {bodyPaint,facePaintReference,prepareBodyPaint,remapFacePaint,samePaintedFace,updateBodyPaint} from '../src/body-face-paint.js';
import {colorMeshSnapshot,createColor3mf} from '../src/color-3mf.js';
import {CLEAR_COLOR,CLEAR_OPACITY,CLEAR_RGB} from '../src/color-choice.js';

test('existing file colours and glazing survive a save and a shape edit',()=>{
 const original=[
  {kind:'cadop',id:'import',outputs:[{id:'cab'},{id:'glass'},{id:'tire'},{id:'plain'}],remove:[]},
  {kind:'cadop',id:'trim',spec:{target:'glass'},remove:['glass'],outputs:[{id:'glass'}]}
 ];
 const next=importBodyAppearance(original,{displayColors:{cab:'#E7E9DF',glass:'#355a6c',tire:'#20252a',plain:'url(invalid)',absent:'#ffffff'},displayOpacity:{glass:.58}});
 const saved=JSON.parse(JSON.stringify(next));
 assert.equal(original[0].bodyAppearance,undefined);
 assert.equal(next[0].outputs,original[0].outputs);
 assert.deepEqual([...bodyAppearances(saved)],[['cab',{color:'#e7e9df'}],['tire',{color:'#20252a'}],['glass',{color:'#355a6c',opacity:.58}]]);
 assert.equal(bodyAppearances([...saved,{kind:'cadop',id:'remove',remove:['glass'],outputs:[]}]).has('glass'),false);
});

test('face paint survives reload, overrides the base on its own triangles and rejects changed geometry',()=>{
 const geometry=new THREE.BoxGeometry(10,10,10);
 const reference=facePaintReference(geometry,[{start:0,count:6}]);
 const original=[{kind:'extrusion',operation:'new',id:'box'}];
 let features=setBodyColor(original,'box','#2466aa',{automatic:true});
 assert.equal(bodyAppearances(features).get('box').automatic,true);
 features=setBodyColor(features,'box','#2466aa');
 assert.equal(bodyAppearances(features).get('box').automatic,undefined);
 features=setBodyFaceColor(features,'box',reference,'#ff0000',samePaintedFace);
 const saved=JSON.parse(JSON.stringify(features));
 const faces=faceColorsByBody(saved).get('box');
 const painted=prepareBodyPaint(geometry,faces);
 updateBodyPaint(painted,'#0000ff');
 assert.deepEqual(bodyPaint(painted).colors,['#ff0000']);
 const colors=painted.attributes.color;
 assert.deepEqual([colors.getX(0),colors.getZ(0),colors.getX(6),colors.getZ(6)],[1,0,0,1]);
 const changed=geometry.clone().translate(0,0,2);
 assert.equal(prepareBodyPaint(changed,faces),changed);
 assert.equal(faceColorsByBody(setBodyFaceColor(saved,'box',reference,null,samePaintedFace)).has('box'),false);
});

test('transparent bodies use their assigned colour without weakening section or QR contrast',()=>{
 const glass={color:'#355a6c',opacity:.58};
 assert.deepEqual(bodyMaterialOptions(glass),{color:'#355a6c',vertexColors:false,roughness:.28,opacity:.58,transparent:true,depthWrite:false});
 assert.equal(bodyMaterialOptions(glass,{splitColor:0x65a9d8}).opacity,1);
 assert.equal(bodyMaterialOptions(glass,{vertexColors:true}).color,0xffffff);
 assert.equal(bodyMaterialOptions().color,0xa3a197);
});

test('transparent paint affects only its selected faces and exports a distinct filament swatch',async()=>{
 const source=new THREE.BoxGeometry(10,10,10);
 const face={...facePaintReference(source,[{start:0,count:6}]),color:CLEAR_COLOR};
 const geometry=prepareBodyPaint(source,[face]);
 updateBodyPaint(geometry,CLEAR_RGB);
 const attribute=geometry.attributes.color;
 assert.equal(attribute.itemSize,4);
 assert.equal(attribute.getW(0),Math.fround(CLEAR_OPACITY));
 assert.equal(attribute.getW(6),1);
 const mesh=new THREE.Mesh(geometry);
 mesh.userData.bodyAppearance={color:CLEAR_RGB,customColor:true};
 const {data,colorCount}=await createColor3mf([colorMeshSnapshot(mesh,'Test')]);
 const xml=strFromU8(unzipSync(data)['3D/3dmodel.model']);
 assert.equal(colorCount,2);
 assert.match(xml,/<m:color color="#F0F4F7FF"/);
 assert.match(xml,/<m:color color="#F0F4F8FF"/);
 assert.equal(bodyMaterialOptions({color:CLEAR_COLOR,customColor:true}).opacity,CLEAR_OPACITY);
});

test('planar paint survives a new hole or depth change and leaves a split face for review',()=>{
 const original=new THREE.BoxGeometry(10,10,10);
 const face={...facePaintReference(original,[{start:24,count:6}]),color:'#ff0000'};
 const outer=new THREE.Shape([[-5,-5],[5,-5],[5,5],[-5,5]].map(point=>new THREE.Vector2(...point)));
 outer.holes.push(new THREE.Path([[-1,-1],[-1,1],[1,1],[1,-1]].map(point=>new THREE.Vector2(...point))));
 const drilled=new THREE.ExtrudeGeometry(outer,{depth:10,bevelEnabled:false}).translate(0,0,-5);
 const holePaint=remapFacePaint(drilled,face);
 assert.equal(holePaint.color,'#ff0000');
 assert.ok(holePaint.ranges.reduce((sum,range)=>sum+range.count,0)>6);
 assert.equal(holePaint.plane.offset,5);
 const resized=new THREE.BoxGeometry(10,10,14);
 assert.equal(remapFacePaint(resized,face).plane.offset,7);
 const split=mergeGeometries([-3,3].map(x=>new THREE.BoxGeometry(4,10,10).translate(x,0,0)));
 assert.equal(remapFacePaint(split,face).unresolved,true);
});

test('a chosen color stays with that solid after a history edit and restores its original appearance',()=>{
 const created={id:'glass',kind:'extrusion',operation:'new',bodyAppearance:{glass:{color:'#355a6c',opacity:.58}}};
 const copy={id:'copy',kind:'cadop',spec:{target:'glass'},outputs:[{id:'copy'}],remove:[]};
 const original=[created,copy];
 const colored=setBodyColor(original,'glass','#c72d4e');
 const edited=inheritBodyColors([{...created,depth:24},copy],colored);
 const saved=bodyAppearances(JSON.parse(JSON.stringify(edited)));
 assert.equal(saved.get('glass').opacity,.58);
 assert.equal(bodyMaterialOptions(saved.get('glass'),{splitColor:0x65a9d8}).color,'#c72d4e');
 assert.equal(saved.get('copy').color,'#355a6c');
 assert.deepEqual(bodyAppearances(setBodyColor(edited,'glass',null)),bodyAppearances(original));
 assert.equal(bodyAppearances([...edited,{kind:'cadop',outputs:[],remove:['glass']}]).has('glass'),false);
});
