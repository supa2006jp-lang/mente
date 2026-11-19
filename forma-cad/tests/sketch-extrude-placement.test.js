import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createSketchExtrudeProjection,placeSketchExtrudeShortcut} from '../src/sketch-extrude-placement.js';

const rectangle=(left,top,right,bottom)=>[[left,top],[right,top],[right,bottom],[left,bottom]];
const place=overrides=>placeSketchExtrudeShortcut({width:600,height:480,panelWidth:188,panelHeight:34,
 anchor:{x:300,y:211},outlines:[rectangle(240,190,360,290)],strokes:[],obstacles:[],...overrides});

test('the row hugs the outside of the nearest sketch edge',()=>{
 assert.deepEqual(place(),{x:206,y:147});
});

test('slanted contours can leave usable exterior space inside their bounding rectangle',()=>{
 const outline=[[200,50],[320,200],[200,350],[80,200]];
 const spot=place({panelWidth:86,outlines:[outline],anchor:{x:240,y:135}});
 assert.ok(spot.y>50&&spot.x<320);
 const rightEdge=axisY=>200+(200-Math.abs(axisY-200)-50)*.8;
 const leftEdge=axisY=>400-rightEdge(axisY);
 for(let y=spot.y;y<=spot.y+34;y+=.5){
  assert.ok(spot.x>=rightEdge(y)||spot.x+86<=leftEdge(y));
 }
});

test('parallel sketch lines and toolbar obstacles move placement only as far outward as needed',()=>{
 const outlines=[rectangle(110,140,490,520)],anchor={x:300,y:180};
 const strokes=[[[0,95],[600,95]],[[0,65],[600,65]]];
 assert.deepEqual(place({outlines,anchor,strokes}),{x:206,y:25});
 const obstacles=[{left:0,top:0,right:600,bottom:12}];
 assert.deepEqual(place({outlines,anchor,strokes,obstacles}),{x:206,y:25});
 const occupied=[{left:205,top:15,right:400,bottom:58}];
 const spot=place({outlines,anchor,strokes,obstacles:occupied});
 assert.ok(spot.x+188<=201||spot.x>=404);
});

test('a narrow exterior strip fits a stack, and a fully zoomed outline has no exterior placement',()=>{
 const space={width:310,height:400,anchor:{x:205,y:200},outlines:[rectangle(-60,-35,208,470)]};
 assert.equal(place(space),null);
 assert.deepEqual(place({...space,panelWidth:78,panelHeight:114}),{x:217,y:143});
 assert.equal(place({...space,outlines:[rectangle(-60,-35,390,470)],panelWidth:78,panelHeight:114}),null);
});

test('sketch projection reuses the camera state and follows a camera pan',()=>{
 const camera=new THREE.OrthographicCamera(-100,100,100,-100,1,500);
 camera.position.z=100;camera.updateMatrixWorld(true);
 const stroke=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(10,20,0)]));
 const project=createSketchExtrudeProjection(camera,()=>[stroke]);
 const region={plane:'XY',offset:0,outer:[[0,0],[10,0],[0,20]]};
 const first=project(200,200);
 const xy=point=>point.slice(0,2).map(Math.round);
 assert.strictEqual(project(200,200),first);
 assert.deepEqual(first.outline(region).map(xy),[[100,100],[110,100],[100,80]]);
 assert.deepEqual(xy(first.strokes[0][1]),[110,80]);
 camera.position.x=10;camera.updateMatrixWorld(true);
 const moved=project(200,200);
 assert.notStrictEqual(moved,first);
 assert.deepEqual(xy(moved.outline(region)[0]),[90,100]);
 stroke.geometry.dispose();stroke.material.dispose();
});
