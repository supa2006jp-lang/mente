import * as THREE from 'three';
const palette=[0x516fd4,0x25a58b,0xa069ce,0xd09527,0x299abd];
const css=n=>'#'+n.toString(16).padStart(6,'0');
function capPoint(part){const {vertices:v,triangles:t}=part,mid=part.bounds[0].map((a,i)=>(a+part.bounds[1][i])/2);let answer=[mid[0],mid[1],part.top],score=Infinity;for(let i=0;i<t.length;i+=3){const ids=t.slice(i,i+3);if(ids.some(n=>Math.abs(v[n*3+2]-part.top)>1e-5))continue;const p=[0,1,2].map(k=>ids.reduce((sum,n)=>sum+v[n*3+k],0)/3),d=(p[0]-mid[0])**2+(p[1]-mid[1])**2;if(d<score){score=d;answer=p;}}return answer;}
export function createSupportRoofView({host,camera,onSelect}){
 const labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';labels.dataset.supportRoofLabels='';host.append(labels);
 let group=null,sections=[],markers=[],selected=null;
 function marker(text,point,color,sectionId,kind){const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.roofMarker=kind;button.dataset.sectionId=sectionId;button.style.cssText='position:absolute;pointer-events:auto;padding:3px 6px;border:2px solid white;border-radius:6px;color:white;font-weight:bold;font-size:12px;box-shadow:0 1px 5px #0006;white-space:nowrap;background:'+css(color);button.onclick=e=>{e.stopPropagation();onSelect(sectionId);};labels.append(button);const entry={button,point:new THREE.Vector3(...point),kind};markers.push(entry);return entry;}
 function clear(){if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}group=null;sections=[];markers=[];labels.replaceChildren();delete host.dataset.supportRoofPreview;}
 function show(data,parent){
  clear();group=new THREE.Group();parent.add(group);sections=data.parts.filter(p=>p.role==='roof').sort((a,b)=>a.top-b.top||a.axis-b.axis||a.bounds[0][1-a.axis]-b.bounds[0][1-b.axis]||a.bounds[0][a.axis]-b.bounds[0][b.axis]).map((p,i)=>({...p,number:i+1,color:css(palette[i%palette.length])}));const colors=new Map(sections.map(s=>[s.id,s.color]));
  for(const p of data.parts.filter(p=>p.role==='roof')){const sectionId=p.id,section=sections.find(s=>s.id===sectionId),color=colors.get(sectionId),geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p.vertices,3)).setIndex(p.triangles);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.6,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.renderOrder=3;mesh.userData.sectionId=sectionId;if(!data.contactLines)group.add(mesh);else{geometry.dispose();mesh.material.dispose();}marker('区画 '+section.number,capPoint(p),palette[(section.number-1)%palette.length],sectionId,'section');}

  if(!sections.some(s=>s.id===selected))selected=sections[0]?.id||null;sync();
 }
 function sync(){for(const m of markers){const p=m.point.clone().project(camera),visible=p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1;m.button.hidden=!visible;if(visible){m.button.style.left=(p.x+1)*host.clientWidth/2+'px';m.button.style.top=(1-p.y)*host.clientHeight/2+'px';m.button.style.transform='translate(-50%,-50%)';}}if(group)host.dataset.supportRoofPreview=JSON.stringify({sections:sections.map(({id,number,color,axis,bounds,limits,sides,top})=>({id,number,color,axis,bounds,limits,sides,top})),tabs:0,selected,picking:false});}
 return {show,clear,sync,get sections(){return sections;},setSelected(id){selected=id;sync();},get selected(){return selected;}};
}
