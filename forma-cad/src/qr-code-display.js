import * as THREE from 'three';
import {qrCodeLayout} from './qr-code-layout.js';

const translation=p=>new THREE.Matrix4().makeTranslation(...p);
function rotation(angles,pivot=[0,0,0]){
 const matrix=new THREE.Matrix4();for(let i=0;i<3;i++)if(angles[i])matrix.premultiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...[[1,0,0],[0,1,0],[0,0,1]][i]),angles[i]*Math.PI/180));
 return translation(pivot).multiply(matrix).multiply(translation(pivot.map(v=>-v)));
}
function reflection(normal,origin){const n=new THREE.Vector3(...normal).normalize(),x=n.x,y=n.y,z=n.z,d=2*n.dot(new THREE.Vector3(...origin));return new THREE.Matrix4().set(1-2*x*x,-2*x*y,-2*x*z,d*x,-2*y*x,1-2*y*y,-2*y*z,d*y,-2*z*x,-2*z*y,1-2*z*z,d*z,0,0,0,1);}
const transform=(items,matrix)=>items.map(item=>({...item,matrix:matrix.clone().multiply(item.matrix)}));

// Derive display placement from history, including older QR saves that do not
// contain explicit colors. Native geometry and project data stay unchanged.
export function qrBodyDisplays(features){
 const displays=new Map();
 for(const feature of features){
  const p=feature.spec,result=feature.cadResult||(feature.kind==='cadop'?feature:null);if(!result)continue;
  const inherited=displays.get(p?.target);
  if(p?.type==='qrCode'){
   try{const layout=qrCodeLayout(p),matrix=new THREE.Matrix4().makeBasis(...['u','v','n'].map(k=>new THREE.Vector3(...p.frame[k])));matrix.setPosition(...p.point);displays.set(result.outputs[0]?.id||p.id,[{layout,matrix}]);}catch{}
  }else if(p?.type==='move'){
   const targets=p.targets||[p.target],copy=p.copy===true||p.moveMode==='複製して移動',delta=[p.x,p.y,p.z],pivot=p.pivot||[0,0,0],angles=p.rotation||[0,0,0];let matrix=rotation(angles,pivot);
   if(!p.rotation&&p.angle)matrix=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])),p.angle*Math.PI/180);
   if(copy&&p.reverseCopy&&Math.hypot(...delta)>1e-7)matrix.premultiply(reflection(delta,pivot));matrix.premultiply(translation(delta));
   targets.forEach((id,i)=>{const items=displays.get(id),out=copy?(i?p.id+'-copy-'+i:p.id):id;if(items&&result.outputs.some(o=>o.id===out))displays.set(out,transform(items,matrix));});
  }else if(p?.type==='printLayout'){
   for(const placement of feature.analysis?.placements||[]){const items=displays.get(placement.id);if(items)displays.set(placement.id,transform(items,translation(placement.translation).multiply(rotation([0,0,placement.rotation||0],placement.pivot))));}
  }else if(p?.type==='mirror'&&inherited){
   const normal=p.mirrorNormal||({XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[p.plane]),n=new THREE.Vector3(...normal).normalize(),origin=p.mirrorNormal?new THREE.Vector3(...p.mirrorOrigin).addScaledVector(n,p.offset||0).toArray():n.multiplyScalar(p.offset||0).toArray(),out=p.mirrorMode==='反転移動'?p.target:p.id;
   displays.set(out,transform(inherited,reflection(normal,origin)));
  }else if(['circular','rectangular'].includes(p?.type)&&inherited){
   const generated=[];if(p.type==='circular'){for(let i=1;i<p.count;i++){const axis=p.axisVector||({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1]),pivot=p.origin||[0,0,0],matrix=translation(pivot).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...axis).normalize(),p.angle*i/p.count*Math.PI/180)).multiply(translation(pivot.map(v=>-v)));generated.push([p.id+'-'+i,transform(inherited,matrix)]);}}
   else for(let i=0;i<p.count;i++)for(let j=0;j<p.count2;j++)if(i||j)generated.push([p.id+'-'+i+'-'+j,transform(inherited,translation([i*p.spacing,j*p.spacing2,0]))]);
   if(p.operation==='結合')displays.set(p.target,[...inherited,...generated.flatMap(([,items])=>items)]);else for(const [id,items]of generated)displays.set(id,items);
  }else if(p?.type==='join'){
   const ids=['切り取り','交差'].includes(p.combineMode)?[p.target]:[p.target,...(p.others||[p.other])],all=ids.flatMap(id=>displays.get(id)||[]);if(all.length)displays.set(p.target,all);
  }else if(inherited)for(const output of result.outputs||[])if(!displays.has(output.id))displays.set(output.id,inherited);
  for(const id of result.remove||[])displays.delete(id);
 }
 return displays;
}

export function colorQrGeometry(source,displays,defaultColor=0xa3a197){
 if(!displays?.length)return source;
 const geometry=source.index?source.toNonIndexed():source.clone();geometry.userData={...source.userData};const position=geometry.attributes.position,colors=new Float32Array(position.count*3),fallback=new THREE.Color(defaultColor),point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),refs=displays.map(d=>({...d,inverse:d.matrix.clone().invert()}));let black=0,white=0;
 for(let i=0;i<position.count;i+=3){a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);const center=a.add(b).add(c).multiplyScalar(1/3);let value=null;
  for(const ref of refs){point.copy(center).applyMatrix4(ref.inverse);const q=ref.layout,tolerance=1e-4;if(Math.abs(point.x)>q.size/2+tolerance||Math.abs(point.y)>q.size/2+tolerance||point.z< -tolerance||point.z>2+tolerance)continue;
   const column=Math.floor((point.x+q.size/2)/q.pitch)-q.quiet,row=Math.floor((q.size/2-point.y)/q.pitch)-q.quiet;value=point.z>1+tolerance&&!!q.matrix[row]?.[column]?0:1;if(value===0)break;
  }
  if(value===0)black++;else if(value===1)white++;for(let j=0;j<3;j++){const k=(i+j)*3;colors[k]=value===null?fallback.r:value;colors[k+1]=value===null?fallback.g:value;colors[k+2]=value===null?fallback.b:value;}
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.userData.qrColors={blackTriangles:black,whiteTriangles:white};return geometry;
}
