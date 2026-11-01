import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {basisFor} from './frames.js';
import {planeCoordinates} from './regions.js';
import {bodyEdges} from './body-edges.js';
import {featureCircularEdges} from './circular-edges.js';
import {createSketchBoundarySnap} from './sketch-boundary-snap.js';
import {solidBoundaryCircleHints} from './sketch-boundary-arcs.js';

export function modelSketchBoundaries(features,source,bodyId,info){
 const bodies=rebuild(features),b=basisFor(source),offset=planeCoordinates(source).offset,snap=createSketchBoundarySnap(),result=[];
 try{const body=bodies.get(bodyId);if(!body)return [];const mesh=new THREE.Mesh(body.geometry),edges=bodyEdges(body.geometry,28);try{edges.userData.circularEdges=featureCircularEdges(features,bodyId,edges);mesh.userData.bodyId=bodyId;result.push({bodyId,info,segments:snap.segments([mesh],b,offset),curves:solidBoundaryCircleHints(features,bodyId,edges,b,offset,info?.circles||[])});}finally{edges.dispose();mesh.material.dispose();}return result;}
 finally{for(const body of bodies.values())body.geometry.dispose();}
}
