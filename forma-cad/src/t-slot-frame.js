import {Matrix4, Vector3} from 'three';
import {cadPosition} from './cad-coordinates.js';
import {innerCornerPositions,placementBox,planInteriorSplices} from './t-slot-inside.js';
import dimensions from './t-slot-dimensions.json' with {type:'json'};

export const FRAME_LIMIT = 160;
export const FRAME_SIZING_VERSION = 4;
const unit = i => new Vector3().setComponent(i, 1);
const round = n => Math.round(n * 1e6) / 1e6;
const boxError = () => Error('6面が直交する立方体または直方体を選んでください。');

// Identify the six supporting planes, not the world-aligned bounding box.
export function measureFrameBox(vertices, triangles) {
  const points = [];
  for (let i=0; i<vertices.length; i+=3) points.push(new Vector3().fromArray(vertices,i));
  if (!points.length) throw boxError();
  const directions=[], faces=[], delta=new Vector3(), normal=new Vector3();
  let volume6=0;
  const ref=points[0];
  for (let i=0; i<triangles.length; i+=3) {
    const [a,b,c]=[0,1,2].map(k=>points[triangles[i+k]]);
    normal.crossVectors(delta.subVectors(b,a),new Vector3().subVectors(c,a));
    const area=normal.length()/2;
    if (area<1e-10) continue;
    volume6+=delta.subVectors(a,ref).dot(normal);
    normal.normalize();
    let axis=directions.findIndex(v=>Math.abs(v.dot(normal))>1-1e-8);
    if (axis<0) {
      if (directions.length===3 || directions.some(v=>Math.abs(v.dot(normal))>1e-5)) throw boxError();
      axis=directions.push(normal.clone())-1;
    }
    faces.push([axis,area,[a,b,c]]);
  }
  if (directions.length!==3) throw boxError();
  const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const score=p=>p.reduce((sum,d,i)=>sum+Math.abs(directions[d].getComponent(i)),0);
  const order=permutations.sort((a,b)=>score(b)-score(a))[0];
  const x=directions[order[0]].clone(), z=directions[order[2]].clone();
  if (x.x<0) x.negate();
  if (z.z<0) z.negate();
  const y=z.clone().cross(x).normalize();
  z.crossVectors(x,y).normalize();
  const axes=[x,y,z], min=[Infinity,Infinity,Infinity], max=min.map(v=>-v);
  for (const point of points) axes.forEach((axis,j)=>{
    const v=point.dot(axis); min[j]=Math.min(min[j],v); max[j]=Math.max(max[j],v);
  });
  const size=max.map((v,i)=>round(v-min[i])), tol=Math.max(1e-5,...size.map(s=>s*2e-7));
  if (size.some(v=>!Number.isFinite(v)||v<=0) ||
      Math.abs(Math.abs(volume6)/6-size[0]*size[1]*size[2])>Math.max(1e-5,size[0]*size[1]*size[2]*1e-5)) throw boxError();
  const areas=[[0,0],[0,0],[0,0]];
  for (const [direction,area,corners] of faces) {
    const j=order.indexOf(direction);
    const side=[min[j],max[j]].findIndex(edge=>corners.every(p=>Math.abs(p.dot(axes[j])-edge)<=tol));
    if(side<0)throw boxError();
    areas[j][side]+=area;
  }
  for(let i=0;i<3;i++){
    const expected=size[(i+1)%3]*size[(i+2)%3];
    if(areas[i].some(a=>Math.abs(a-expected)>Math.max(1e-6,expected*1e-5)))throw boxError();
  }
  const origin=new Vector3(); axes.forEach((a,i)=>origin.addScaledVector(a,min[i]));
  return {origin:origin.toArray(),axes:axes.map(a=>a.toArray()),size};
}
export function measureFrameGeometry(geometry) {
  if(!geometry)throw boxError();
  const position=cadPosition(geometry),index=geometry.index;
  return measureFrameBox(position.array,index?.array??Array.from({length:position.count},(_,i)=>i));
}

// A span describes a drilled plate. The original four-hole splice is a stock solid.
export function plateDimensions(part) {
  if(part.span===undefined)return null;
  const half=part.span/2;
  return {length:part.span+18,width:part.kind==='splice'?22:18,height:8,holes:part.shared?[-half,0,half]:[-half,half]};
}
export function plateKey(part) {
  // A shallow tongue registers both sides of a butt joint, between the two nuts.
  if(part.kind==='splice'&&part.span!==undefined)
    return {halfLength:3,levels:[[8,4.8],[9.1,4.8],[9.5,4.4]]};
  // The wider key for a short horizontal member slides into its T-slot from the end.
  if (!part.keyed) return null;
  const railLength=round(part.span-28);
  return {halfLength:railLength/2-Math.min(.25,railLength/10),
    levels:[[8,4.8],[10.85,4.8],[12.6,6.55],[13.15,6.55],[13.65,6.05]]};
}
export function plateOutline(part) {
  const {length,width}=plateDimensions(part), x=length/2, y=width/2, r=1.5;
  return [[-x+r,-y],[x-r,-y],[x,-y+r],[x,y-r],[x-r,y],[-x+r,y],[-x,y-r],[-x,-y+r]];
}
export function framePartKey(part) {
  if (part.kind==='rail') return 'rail-'+part.length;
  if (part.kind==='bolt'&&part.length===10) return 'bolt-10';
  if (part.kind==='splice'&&part.span!==undefined) return 'splice-2';
  if (part.kind==='corner'&&part.panelHole) return 'corner-panel';
  if (part.kind==='strap') return 'strap-'+part.span+(part.keyed?'-keyed':part.shared?'-shared':'');
  return part.kind;
}
export function framePartName(part) {
  if (part.kind==='rail') return 'T溝フレーム '+round(part.length)+' mm';
  if (part.kind==='bolt') return part.length===10?'M8×10 ボルト':'M8×16 ボルト';
  if (part.kind==='splice') return part.span===undefined?'4穴直線連結プレート 90 mm':'2穴直線連結プレート '+plateDimensions(part).length+' mm';
  if (part.kind==='corner'&&part.panelHole) return '直角連結ブラケット（透明板用M8めねじ）';
  if (part.keyed) return '短尺材用キー付きプレート '+round(part.span+18)+' mm';
  if (part.kind==='strap') return part.shared?'3穴外付けプレート '+Number((part.span+18).toFixed(3))+' mm':'2穴外付けプレート';
  return {corner:'直角連結ブラケット',nut:'M8 T溝ナット（−0.10 mm調整版）'}[part.kind];
}
export function framePartBounds(part) {
  if (part.kind==='rail') return [[-14,-14,0],[14,14,part.length]];
  const plate=plateDimensions(part);
  if (plate) {
    const x=plate.length/2,y=plate.width/2,key=plateKey(part);
    return [[-x,-y,0],[x,y,key?key.levels.at(-1)[0]:plate.height]];
  }
  return dimensions.bounds[framePartKey(part)]??dimensions.bounds[part.kind];
}

export function validateFrameBox(box,sizingVersion=FRAME_SIZING_VERSION) {
  if(!Number.isInteger(sizingVersion)||sizingVersion<1||sizingVersion>FRAME_SIZING_VERSION)throw Error('このフレームの寸法形式を読み込めません。');
  const triple=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  if(!triple(box?.origin)||!triple(box.size)||box.size.some(v=>v<=0||v>200000)||
      !Array.isArray(box.axes)||box.axes.length!==3||!box.axes.every(triple))throw boxError();
  const [x,y,z]=box.axes.map(a=>new Vector3(...a));
  if([x,y,z].some(a=>Math.abs(a.lengthSq()-1)>1e-5)||Math.abs(x.dot(y))>1e-5||
      x.clone().cross(y).distanceTo(z)>1e-5)throw boxError();
}
export function frameAssembly(box,sizingVersion=FRAME_SIZING_VERSION) {
  validateFrameBox(box,sizingVersion);
  const {size}=box;
  // Old saved bodies used a 20 mm minimum opening and micron-rounded seam positions.
  const legacy=sizingVersion===1;
  const newFittings=sizingVersion>=3;
  const preferInside=sizingVersion>=4;
  const splice=newFittings?{kind:'splice',span:27}:{kind:'splice'};
  const clear=legacy?size.map((v,i)=>i<2?Math.max(20,v):v):size;
  const runs=[clear[0],clear[1],round(clear[2]+56)].map(span=>{
    const count=Math.ceil(span/FRAME_LIMIT);
    return {span,count,length:span/count};
  });
  const origin=new Vector3(...box.origin), axes=box.axes.map(a=>new Vector3(...a));
  axes.forEach((a,i)=>origin.addScaledVector(a,(size[i]-clear[i])/2));
  const world=new Matrix4().makeBasis(...axes).setPosition(origin);
  const parts=[],railBoxes=[],fixtureBoxes=[],fixedNuts=[],jointGroups=new Map();
  let fixings=0;
  function add(part,position,x,y,z,holes=0,mount) {
    const matrix=world.clone().multiply(new Matrix4().makeBasis(x,y,z).setPosition(position));
    parts.push({...part,matrix,...(preferInside&&mount?{mount}:{})}); fixings+=holes;
    if(preferInside&&part.kind==='corner'){
      // Installed bracket and bolt heads. Register the two nuts at their slot mouths.
      for(const [lo,hi] of [
        [[0,0,0],[38,8,24]],[[0,0,0],[8,38,24]],[[8,8,0],[34.5,34.5,3.6]],
        [[7.5,7.5,3.6],[20.5,20.5,8]],[[8,19.6,4.6],[13.8,34.4,19.4]],[[19.6,8,4.6],[34.4,13.8,19.4]]
      ])fixtureBoxes.push(placementBox(position,x,y,z,lo,hi));
      fixedNuts.push({normal:x,point:position.clone().addScaledVector(y,27).addScaledVector(z,12)},
        {normal:y,point:position.clone().addScaledVector(x,27).addScaledVector(z,12)});
    }
  }
  function plate(part,at,along,out,mount='outside') {
    if(preferInside&&part.kind==='strap'){
      const dim=plateDimensions(part),half=dim.length/2;
      fixtureBoxes.push(placementBox(at,along,out.clone().cross(along),out,[-half,-9,0],[half,9,13.8]));
      for(const offset of dim.holes)fixedNuts.push({normal:out,point:at.clone().addScaledVector(along,offset)});
    }
    if(plateKey(part)){
      // The printed flat face is outside; the key on the opposite face enters the slot.
      at=at.clone().addScaledVector(out,8);
      out=out.clone().negate();
    }
    add(part,at,along,out.clone().cross(along),out,plateDimensions(part)?.holes.length??4,mount);
  }
  function beam(at,along,run,spliceNormal,insideNormals,axis) {
    const x=unit(along.z?0:2), y=along.clone().cross(x);
    if(preferInside)railBoxes.push(placementBox(at,x,y,along,[-14,-14,0],[14,14,run.span]));
    for(let i=0;i<run.count;i++){
      const start=legacy?round(run.span*i/run.count):i*run.length;
      const length=legacy?round(round(run.span*(i+1)/run.count)-start):run.length;
      add({kind:'rail',length},at.clone().addScaledVector(along,start),x,y,along);
      if(!i)continue;
      const center=at.clone().addScaledVector(along,start);
      if(preferInside){
        const key=axis+'-'+i;
        if(!jointGroups.has(key))jointGroups.set(key,[]);
        jointGroups.get(key).push({center,along,normals:[...insideNormals,...insideNormals.map(n=>n.clone().negate())]});
      }else plate(splice,center.addScaledVector(spliceNormal,14),along,spliceNormal);
    }
  }
  const face=(i,high)=>high?clear[i]:0;
  const outside=(i,high)=>face(i,high)+(high?14:-14);
  for(const highX of [false,true]) for(const highY of [false,true]) {
    const outX=unit(0).multiplyScalar(highX?1:-1),inX=outX.clone().negate(),inY=unit(1).multiplyScalar(highY?-1:1);
    beam(new Vector3(outside(0,highX),outside(1,highY),-28),unit(2),runs[2],outX,clear[0]>=clear[1]?[inX,inY]:[inY,inX],2);
  }
  for(const axis of [0,1]) {
    const side=1-axis, along=unit(axis);
    const insideEnds=preferInside?innerCornerPositions(clear[axis],clear[2]):null;
    for(const highSide of [false,true]) for(const highZ of [false,true]) {
      const at=new Vector3().setComponent(side,outside(side,highSide)).setZ(outside(2,highZ));
      const outZ=unit(2).multiplyScalar(highZ?1:-1);
      const outSide=unit(side).multiplyScalar(highSide?1:-1);
      beam(at,along,runs[axis],outZ,[outSide.clone().negate(),outZ.clone().negate()],axis);
      const mountingFace=at.clone().addScaledVector(outSide,14);
      // Two 38 mm inside brackets would overlap on short spans. Fasten the
      // coplanar outside faces instead. A shared strap can use one central nut.
      if(clear[axis]<40&&!insideEnds?.size) {
        const part={kind:'strap',span:round(clear[axis]+28)};
        if(clear[axis]<20)part.keyed=true;else part.shared=true;
        plate(part,mountingFace.addScaledVector(along,clear[axis]/2),along,outSide);
        continue;
      }
      for(const highEnd of [false,true]) {
        const inward=along.clone().multiplyScalar(highEnd?-1:1), end=face(axis,highEnd);
        const inner=insideEnds?insideEnds.has(Number(highEnd)+2*Number(highZ)):clear[axis]>=76&&clear[2]>=76;
        if(!inner) {
          // A perpendicular beam ends on the inner post face here. The coplanar
          // outside strap can fasten to both the post and this horizontal beam.
          const center=mountingFace.clone().setComponent(axis,end).addScaledVector(inward,-2);
          plate({kind:'strap',span:24},center,inward,outSide);
        } else {
          const up=outZ.clone().negate(), width=inward.clone().cross(up);
          // The four panel seats on each side share a plane facing out. Swapping
          // the two symmetric legs preserves the handedness of the M8 thread.
          const swap=newFittings&&width.dot(outSide)>0;
          if(swap)width.negate();
          const corner=at.clone().setComponent(axis,end).setZ(face(2,highZ)).addScaledVector(width,-12);
          add(newFittings?{kind:'corner',panelHole:true}:{kind:'corner'},corner,swap?up:inward,swap?inward:up,width,2,'inside');
        }
      }
    }
  }
  for(const group of jointGroups.values()){
    const placements=planInteriorSplices(group,railBoxes,fixtureBoxes,fixedNuts);
    placements.forEach((p,i)=>plate(splice,p.at,group[i].along,p.normal,p.inside?'inside':'outside'));
  }
  return {parts,fixings,runs,clearance:clear.map((v,i)=>(v-size[i])/2)};
}

export function savedFrameAssembly(analysis) {
  return frameAssembly(analysis.tSlotBox,analysis.tSlotSizingVersion??1);
}

export function frameBill(assembly,extraBolts=0,extraNuts=0,extraShortBolts=0) {
  if (![extraBolts,extraNuts,extraShortBolts].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000))
    throw Error('追加数はそれぞれ0〜10000の整数で入力してください。');
  const bill=new Map();
  function count(part,n) {
    const key=framePartKey(part),existing=bill.get(key);
    if (existing) existing.count+=n;
    else {const {matrix,mount,...definition}=part;bill.set(key,{...definition,key,count:n});}
  }
  for(const part of assembly.parts) count(part,1);
  count({kind:'bolt'},assembly.fixings+extraBolts);
  if(extraShortBolts)count({kind:'bolt',length:10},extraShortBolts);
  count({kind:'nut'},assembly.fixings+extraNuts);
  return [...bill.values()];
}
