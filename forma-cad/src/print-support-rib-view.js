import * as THREE from 'three';
import {clipTriangle} from './box-selection.js';
const palette={rib:0x008264,allow:0xe0a120,block:0xc2344c,flat:0x346dcc};
export const supportPolicyLegend=[
 ['rib','リブで支える'],['allow','自動サポートに任せる'],['block','自動サポートも禁止'],['flat','接触線を省いた薄皮']
].map(([key,label])=>({key,label,color:'#'+palette[key].toString(16).padStart(6,'0')}));

export function createSupportRibView({host,canvas,camera,onToggle}){
 const labels=document.createElement('div');labels.dataset.supportRibLabels='';labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(labels);
 const hint=document.createElement('div');hint.className='support-rib-hover';hint.hidden=true;host.append(hint);
 const riskColor=item=>item.review?0x7442c8:item.risk?.severity==='high'?0xb33690:item.risk?.severity==='caution'?0xeaa429:0x109bb5,restOpacity=item=>item.excluded?.28:item.review?.54:item.risk?.severity==='high'?.7:item.risk?.severity==='caution'?.45:0;
 const ray=new THREE.Raycaster(),screenPoint=new THREE.Vector2();
 const directions=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
 let group=null,policyGroup=null,items=[],meshes=[],markers=[],picking=false,skinGroups=[],hoverGroup=null,hoverId=null;
 function setComparisonHidden(hidden){
  if(group)group.visible=!hidden;
  labels.hidden=hidden;
  if(hidden)hover(null);
 }
 let selected=new Set(),policyVisible=false,reviewOrigins=[],printPolicies=[],reviewOutlines=[];
 function dispose(object){object?.removeFromParent();object?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 function clear(){hover(null);dispose(group);group=policyGroup=null;items=[];meshes=[];markers=[];skinGroups=[];reviewOutlines=[];labels.replaceChildren();labels.hidden=false;delete host.dataset.supportRibPreview;}
 function show(data,parent,skins=[],{review=[],printRegions=[],showMarkers=true}={}){clear();
  const candidates=new Set(review.flatMap(item=>item.candidates));
  items=data.map(item=>({...item,review:candidates.has(item.id)}));skinGroups=skins;group=new THREE.Group();parent.add(group);
  policyGroup=new THREE.Group();group.add(policyGroup);
  for(const region of printRegions){
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(region.vertices,3)).setIndex(region.triangles);
   const material=new THREE.MeshBasicMaterial({color:palette[region.policy],side:THREE.DoubleSide,transparent:true,opacity:.6,depthTest:false,depthWrite:false});
   const overlay=new THREE.Mesh(geometry,material);overlay.renderOrder=region.policy==='flat'?23:region.policy==='block'?22:21;policyGroup.add(overlay);
  }
  for(const {location,candidates} of review){
   const [min,max]=location.bounds,size=new THREE.Vector3().fromArray(max).sub(new THREE.Vector3().fromArray(min));
   const box=new THREE.BoxGeometry(size.x,size.y,size.z);
   const outline=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineDashedMaterial({color:0x503686,dashSize:1.6,gapSize:1,depthTest:false,depthWrite:false}));
   box.dispose();outline.computeLineDistances();
   outline.position.fromArray(min).addScaledVector(size,.5);outline.renderOrder=27;group.add(outline);
   reviewOutlines.push({id:location.id,candidates,outline});
  }
  reviewOrigins=review.map(item=>item.location.bounds);printPolicies=printRegions.map(item=>item.policy);
  for(const item of items){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(item.vertices,3)).setIndex(item.triangles);geometry.computeVertexNormals();const material=new THREE.MeshBasicMaterial({color:item.excluded?0xc63a48:riskColor(item),transparent:true,opacity:picking?.45:restOpacity(item),depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mesh=new THREE.Mesh(geometry,material);mesh.userData.ribId=item.id;mesh.renderOrder=8;meshes.push(mesh);group.add(mesh);
   if(item.excluded){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0xc63a48,transparent:true,opacity:.8}));edges.renderOrder=9;mesh.userData.outline=edges;group.add(edges);}
   if(showMarkers){
    const point=geometry.boundingBox||(geometry.computeBoundingBox(),geometry.boundingBox),at=point.getCenter(new THREE.Vector3());at.setComponent(item.axis,item.center);const button=document.createElement('button');button.type='button';button.dataset.ribMarker=item.id;button.textContent=(item.review?'候補 ':item.excluded?'除外 ':'リブ ')+item.number;button.style.cssText='position:absolute;pointer-events:auto;padding:3px 5px;border:2px solid white;border-radius:5px;color:white;background:'+(item.review?'#673ab2':item.excluded?'#b93143':'#087f9e')+';font-size:12px;white-space:nowrap;box-shadow:0 1px 4px #0005';button.onclick=e=>{e.stopPropagation();if(picking||item.review)onToggle(item.id,e);};button.onpointerenter=()=>hover(item.id);button.onpointerleave=()=>hover(null);labels.append(button);markers.push({button,point:at,item});
   }
 }updateAppearance();sync();
 }
 function sync(){for(const m of markers){const p=m.point.clone().project(camera);m.button.hidden=(!picking&&!m.item.excluded&&!m.item.review&&!selected.has(m.item.id))||p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;m.button.style.pointerEvents=picking||m.item.review?'auto':'none';if(!m.button.hidden){m.button.style.left=(p.x+1)*host.clientWidth/2+'px';m.button.style.top=(1-p.y)*host.clientHeight/2+'px';m.button.style.transform='translate(-50%,-50%)';}}
 }
 function updateAppearance(){
  if(!group)return;
  policyGroup.visible=policyVisible;
  for(const [index,item] of items.entries()){
   const material=meshes[index].material,marked=selected.has(item.id);
   const policy=item.excluded?(item.autoBlocked?'block':'allow'):'rib';
   material.color.setHex(marked?0x136dc8:item.review?0x7442c8:policyVisible?palette[policy]:item.excluded?0xc63a48:riskColor(item));
   material.opacity=marked?.85:policyVisible?.56:picking?.45:restOpacity(item);
   meshes[index].userData.outline?.material.color.copy(material.color);
   if(markers[index]){
    markers[index].button.style.outline=marked?'3px solid #3288e4':'';
    markers[index].button.style.background=policyVisible?'#'+material.color.getHexString():item.review?'#673ab2':item.excluded?'#b93143':'#087f9e';
   }
  }
  host.dataset.supportRibPreview=JSON.stringify({picking,selected:[...selected],policyVisible,reviewOrigins,printRegions:printPolicies,
   ribs:items.map(({id,ribId,number,axis,center,bounds,excluded,risk,unsupportedWidth,autoBlocked,review})=>({id,ribId,number,axis,center,bounds,excluded,risk,unsupportedWidth,autoBlocked,review}))});
 }
 function setDisplay({picking:pickMode=false,selection=[],policies=false,source=null}={}){
  picking=pickMode;selected=new Set(selection);policyVisible=policies;
  host.toggleAttribute('data-support-rib-picking',picking);
  updateAppearance();focusReview(source);sync();
 }
 function focusReview(source){
  const active=reviewOutlines.find(item=>item.id===source);
  for(const item of reviewOutlines){
   item.outline.material.transparent=true;
   item.outline.material.opacity=!active||item===active?1:.22;
  }
  for(const {button,item} of markers){
   button.style.opacity=active&&item.review&&!active.candidates.includes(item.id)?'.35':'';
  }
 }
 function pick(event,{near=picking,reviewOnly=false}={}){
  if(!group||!meshes.length)return null;
  const candidates=reviewOnly?meshes.filter((_,index)=>items[index].review):meshes;
  const {left,top,width,height}=canvas.getBoundingClientRect(),x=event.clientX-left,y=event.clientY-top;
  const hitAt=(dx,dy)=>{
   screenPoint.set((x+dx)*2/width-1,1-(y+dy)*2/height);
   ray.setFromCamera(screenPoint,camera);
   return ray.intersectObjects(candidates,false)[0];
  };
  const direct=hitAt(0,0);
  if(direct)return direct.object.userData.ribId;
  if(!near)return null;
  // The mesh raycast has no pixel tolerance. Probe outward only after a direct miss.
  for(const radius of [2,4,6,8]){
   let nearest;
   for(const [dx,dy] of directions){
    const hit=hitAt(dx*radius,dy*radius);
    if(hit&&(!nearest||hit.distance<nearest.distance))nearest=hit;
   }
   if(nearest)return nearest.object.userData.ribId;
  }
  return null;
 }
 function hover(id){
  if(hoverId===id)return;
  hoverId=id;dispose(hoverGroup);hoverGroup=null;hint.hidden=true;
  const rib=items.find(item=>item.id===id);
  if(!rib)return;
  const width=rib.unsupportedWidth??(rib.band?rib.band[1]-rib.band[0]:0);
  const sides=new Set();
  if(!rib.excluded&&rib.band){
   hoverGroup=new THREE.Group();group.add(hoverGroup);
   for(const skin of skinGroups[rib.skinGroup]||[]){
    if(rib.id!==rib.ribId&&!skin.ribs.includes(rib.id))continue;
    let [low,high]=rib.band;
    if(low>=skin.limits[1]||high<=skin.limits[0])continue;
    if(skin.side==='upper'){
     const remaining=items.filter(item=>item!==rib&&skin.ribs.includes(item.id));
     const left=remaining.filter(item=>item.center<rib.center),right=remaining.filter(item=>item.center>rib.center);
     low=left.length<2?skin.limits[0]:Math.min(low,left.at(-1).bounds[0][rib.axis]);
     high=right.length<2?skin.limits[1]:Math.max(high,right[0].bounds[1][rib.axis]);
    }else if(skin.ribs.length===1&&skin.ribs[0]===rib.id){
     [low,high]=skin.limits;
    }
    if(low>=skin.limits[1]||high<=skin.limits[0]||low>=high)continue;
    const axis=new THREE.Vector3().setComponent(rib.axis,1);
    const planes=[new THREE.Plane(axis,-low),new THREE.Plane(axis.clone().negate(),high)];
    if(rib.id!==rib.ribId){
     const other=1-rib.axis,direction=new THREE.Vector3().setComponent(other,1);
     planes.push(new THREE.Plane(direction,-rib.bounds[0][other]),new THREE.Plane(direction.clone().negate(),rib.bounds[1][other]));
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(skin.vertices,3)).setIndex(skin.triangles);
    const material=new THREE.MeshBasicMaterial({color:0xf13852,opacity:.66,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
     clippingPlanes:planes});
    const overlay=new THREE.Mesh(geometry,material);overlay.renderOrder=25;hoverGroup.add(overlay);
    sides.add(skin.side==='upper'?'上面':'底面');
   }
  }
  hint.textContent='リブ '+rib.number+(rib.excluded?' ／ 支えなし 約 ':' ／ 除外後の支えなし幅 約 ')+Number(width.toFixed(1))+' mm'+
   (sides.size?' ／ 赤：消える薄皮の範囲の目安（'+[...sides].join('・')+'）':'')+
   (rib.excluded?' ／ '+(rib.autoBlocked?'自動サポートも禁止':'自動サポートに任せる'):'');
  hint.hidden=false;
 }
 function range(rect){
  const width=canvas.clientWidth,height=canvas.clientHeight,point=new THREE.Vector3();
  return meshes.flatMap(mesh=>{
   const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,screen=[];
   for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).project(camera);
    screen.push({x:(point.x+1)*width/2,y:(1-point.y)*height/2,z:point.z});
   }
   if(!screen.length)return [];
   const inside=({x,y,z})=>x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom&&Math.abs(z)<=1;
   if(screen.every(inside))return [mesh.userData.ribId];
   if(!rect.crossing)return [];
   for(let i=0;i<index.count;i+=3){
    const points=[screen[index.getX(i)],screen[index.getX(i+1)],screen[index.getX(i+2)]];
    if(points.every(p=>Math.abs(p.z)<=1)&&clipTriangle(points,rect).length>=3)return [mesh.userData.ribId];
   }
   return [];
  });
 }
 return {show,clear,sync,pick,range,hover,setDisplay,setComparisonHidden,get items(){return items;}};
}
