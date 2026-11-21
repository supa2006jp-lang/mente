import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {cadPlanarFaceIds} from './cad-topology.js';
import {FRAME_SIZING_VERSION,frameAssembly,framePartKey,plateDimensions,plateKey,plateOutline} from './t-slot-frame.js';
import stock from './t-slot-fixtures.json' with {type:'json'};
import dimensions from './t-slot-dimensions.json' with {type:'json'};

function extrudePolygon(points,delta) {
  const face=R.makePolygon(points), vector=new R.Vector(delta);
  try {return R.basicFaceExtrusion(face,vector);} finally {face.delete();vector.delete();}
}
function prism(points,height) {
  return extrudePolygon(points.map(([x,y])=>[x,y,0]),[0,0,height]);
}
export function makeFramePart(part) {
  if (part.kind==='rail') return prism(dimensions.profile,part.length);
  const plate=plateDimensions(part);
  if (!plate) return R.deserializeShape(stock[framePartKey(part)]).asShape3D();
  let shape=prism(plateOutline(part),plate.height);
  try {
    for(const x of plate.holes) {
      const hole=R.makeCylinder(4.5,10,[x,0,-1]);
      try {const cut=shape.cut(hole);shape.delete();shape=cut;} finally {hole.delete();}
    }
    const key=plateKey(part);
    if(key) {
      // Start the key inside the plate so its neck and plate form one BREP solid.
      const levels=[[7.75,key.levels[0][1]],...key.levels.slice(1)];
      const side=levels.map(([z,w])=>[-key.halfLength,w,z]);
      const other=[...levels].reverse().map(([z,w])=>[-key.halfLength,-w,z]);
      const tongue=extrudePolygon([...side,...other],[2*key.halfLength,0,0]);
      try {const joined=shape.fuse(tongue);shape.delete();shape=joined;} finally {tongue.delete();}
    }
    return shape;
  } catch(error) {shape.delete();throw error;}
}
function located(shape,matrix) {
  const oc=R.getOC(), pose=new oc.gp_Trsf(), m=matrix.elements;
  try {
    pose.SetValues(m[0],m[4],m[8],m[12],m[1],m[5],m[9],m[13],m[2],m[6],m[10],m[14]);
    const location=new oc.TopLoc_Location(pose);
    try {return R.cast(shape.wrapped.Moved(location));} finally {location.delete();}
  } finally {pose.delete();}
}
export function makeTSlotFrame(box,spec,onProgress) {
  const {parts}=frameAssembly(box,FRAME_SIZING_VERSION,spec.maxRailLength), prototypes=new Map(), outputs=[],bodyNames={},bodyColors={};
  try {
    for(const group of ['rails','fittings']) {
      const members=parts.filter(p=>(p.kind==='rail')===(group==='rails'));
      const label=group==='rails'?'T溝フレーム材':'T溝フレーム固定治具';
      onProgress?.({stage:label+'を配置しています'});
      // Keep each BREP / render buffer within the existing per-body document budget.
      for(let i=0;i<members.length;i+=24) {
        const instances=[];
        try {
          for(const part of members.slice(i,i+24)) {
            const key=framePartKey(part);
            if(!prototypes.has(key)) prototypes.set(key,makeFramePart(part));
            instances.push(located(prototypes.get(key),part.matrix));
          }
          const compound=R.makeCompound(instances); // takes ownership of the instances
          instances.length=0;
          try {
            const id=spec.id+'-'+group+(i?'-'+i/24:'');
            const brep=compound.serialize(), mesh=cadMesh(compound);
            outputs.push({id,...mesh,brep,cadCoordinatePrecision:true,planarFaces:cadPlanarFaceIds(compound)});
            bodyNames[id]=label+(members.length>24?' '+(i/24+1):'');
            bodyColors[id]=group==='rails'?'#82939c':'#16827c';
          } finally {compound.delete();}
        } finally {instances.forEach(s=>s.delete());}
      }
    }
    return {outputs,remove:[],bodyNames,bodyColors,analysis:{tSlotBox:box,tSlotSizingVersion:FRAME_SIZING_VERSION,
      ...(spec.maxRailLength===undefined?{}:{tSlotMaxRailLength:spec.maxRailLength})}};
  } finally {prototypes.forEach(shape=>shape.delete());}
}
