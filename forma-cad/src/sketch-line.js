import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// Keep the original line for picking. Screen-width strokes provide a white
// border over colored axes and stay legible at every zoom and pixel ratio.
export function sketchLine(geometry,{color=0x245d99,depthTest=true,order=4,segments=false}={}){
 const line=segments?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,depthTest,depthWrite:false})):new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,depthTest,depthWrite:false}));
 line.renderOrder=order;
 for(const [stroke,width,layer] of [[0xffffff,6,.1],[color,3,.2]]){
  const g=segments?new LineSegmentsGeometry():new LineGeometry();g.setPositions(Array.from(geometry.attributes.position.array));
  const material=new LineMaterial({color:stroke,linewidth:width,worldUnits:false,transparent:true,depthTest,depthWrite:false});
  const display=segments?new LineSegments2(g,material):new Line2(g,material);display.renderOrder=order+layer;display.raycast=()=>{};display.userData.sketchStroke=true;line.add(display);
 }
 return line;
}
export function updateSketchLine(line,geometry){
 line.geometry.dispose();line.geometry=geometry;
 for(const child of line.children)if(child.userData.sketchStroke)child.geometry.setPositions(Array.from(geometry.attributes.position.array));
}
