import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// Keep the original line for picking. Screen-width strokes provide a white
// border over colored axes and stay legible at every zoom and pixel ratio.
export function sketchLine(geometry,{color=0x245d99,depthTest=true,order=4,segments=false,planeNormal=null}={}){
 const line=segments?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:0,depthTest,depthWrite:false})):new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:0,depthTest,depthWrite:false}));
 line.renderOrder=order;
 for(const [stroke,width,layer] of [[0xffffff,6,.1],[color,3,.2]]){
  const g=segments?new LineSegmentsGeometry():new LineGeometry();g.setPositions(Array.from(geometry.attributes.position.array));
  const material=new LineMaterial({color:stroke,linewidth:width,worldUnits:false,transparent:true,depthTest,depthWrite:false,polygonOffset:depthTest,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  if(depthTest&&planeNormal){
   // Line2 widens in screen space. Restore the sketch plane's depth at each
   // widened vertex, then bias it slightly to avoid fighting the solid face.
   // Both border and core follow the same plane and retain solid occlusion.
   material.onBeforeCompile=shader=>{
    shader.uniforms.sketchPlaneNormal={value:planeNormal.clone()};
    shader.vertexShader='uniform vec3 sketchPlaneNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('gl_Position = clip;', ` 
     #ifndef WORLD_UNITS
      vec3 planeN = normalize(mat3(modelViewMatrix) * sketchPlaneNormal);
      vec3 anchor = (position.y < 0.5) ? start.xyz : end.xyz;
      vec2 ndc = clip.xy / clip.w;
      if (projectionMatrix[2][3] == -1.0) {
       vec3 ray = vec3((ndc + vec2(projectionMatrix[2][0], projectionMatrix[2][1])) / vec2(projectionMatrix[0][0], projectionMatrix[1][1]), -1.0);
       float denominator = dot(planeN, ray);
       if (abs(denominator) > 0.01) {
        vec4 planeClip = projectionMatrix * vec4(ray * (dot(planeN, anchor) / denominator), 1.0);
        clip.z = planeClip.z / planeClip.w * clip.w;
       }
      } else if (abs(planeN.z) > 0.01) {
       vec2 xy = (ndc - vec2(projectionMatrix[3][0], projectionMatrix[3][1])) / vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
       float z = (dot(planeN, anchor) - dot(planeN.xy, xy)) / planeN.z;
       clip.z = (projectionMatrix * vec4(xy, z, 1.0)).z;
      }
     #endif
     gl_Position = clip;
    `);
   };
   material.customProgramCacheKey=()=> 'sketch-plane-stroke-v1';
  }
  const display=segments?new LineSegments2(g,material):new Line2(g,material);display.renderOrder=order+layer;display.raycast=()=>{};display.userData.sketchStroke=true;line.add(display);
 }
 return line;
}
export function updateSketchLine(line,geometry){
 line.geometry.dispose();line.geometry=geometry;
 for(const child of line.children)if(child.userData.sketchStroke)child.geometry.setPositions(Array.from(geometry.attributes.position.array));
}
