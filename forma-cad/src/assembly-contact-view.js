import * as THREE from 'three';
const number=value=>Number(value.toFixed(6)).toString();
export function createAssemblyContactView({container,scene,bodyName,getObject}){
 const panel=document.createElement('section');panel.dataset.id='contact';panel.hidden=true;panel.innerHTML='<strong data-contact-status role="status"></strong><p data-contact-detail></p><div data-contact-rows></div><small>赤：めり込み部分 ／ 青い線：最短の隙間 ／ 緑：接触箇所</small>';container.append(panel);
 let group=null;const colors={interference:0xd83c2e,contact:0x078658,gap:0x187ac1,unknown:0x727c83};
 function clearGraphics(){if(!group)return;scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group=null;}
 function clear(){clearGraphics();panel.hidden=true;panel.querySelector('[data-contact-rows]').replaceChildren();}
 function pending(){clearGraphics();panel.hidden=false;panel.querySelector('[data-contact-status]').textContent='隙間・めり込みを再検査中…';panel.querySelector('[data-contact-detail]').textContent='';panel.querySelector('[data-contact-rows]').replaceChildren();panel.dataset.status='pending';}
 function show(report,highlights=[]){
  clear();panel.hidden=false;panel.dataset.status=report.status;const status=panel.querySelector('[data-contact-status]'),detail=panel.querySelector('[data-contact-detail]'),labels={interference:'めり込みあり',contact:'接触',gap:'隙間あり',unknown:'検査未完了',none:'検査する相手がありません'};status.textContent=labels[report.status]+(!report.complete&&report.status!=='unknown'?'（一部未検査）':'');status.style.color='#'+(colors[report.status]||colors.unknown).toString(16).padStart(6,'0');
  const failures=report.rows.filter(r=>r.status==='interference'),minimum=report.nearest?.distance;detail.textContent=failures.length?failures.length+'組にめり込みがあります。合計 '+number(failures.reduce((s,r)=>s+r.volume,0))+' mm³':Number.isFinite(minimum)&&minimum>1e-6?'最短の隙間 '+number(minimum)+' mm':report.complete?'CAD形状で接触を確認しました':'検査上限または計算できない組合せがあります。';
  if(!report.complete)detail.append(document.createTextNode(' 未検査の組合せを含みます。'));
  const ranked=[...report.rows].sort((a,b)=>(a.status==='interference'?0:a.status==='unknown'?2:1)-(b.status==='interference'?0:b.status==='unknown'?2:1)||(a.distance??Infinity)-(b.distance??Infinity));
  function focus(row){
   clearGraphics();group=new THREE.Group();scene.add(group);const color=colors[row.status]||colors.unknown;
   for(const id of [row.source,row.target]){const object=getObject(id);if(object){object.updateWorldMatrix(true,true);const outline=new THREE.BoxHelper(object,color);outline.material.depthTest=false;outline.renderOrder=80;group.add(outline);}}
   for(const mesh of highlights.filter(h=>h.source===row.source&&h.target===row.target)){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);geometry.computeVertexNormals();const object=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthTest:false}));object.renderOrder=82;group.add(object);}
   if(row.points){const geometry=new THREE.BufferGeometry().setFromPoints(row.points.map(p=>new THREE.Vector3(...p)));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:false}));line.renderOrder=83;group.add(line);const dots=new THREE.Points(geometry.clone(),new THREE.PointsMaterial({color,size:9,sizeAttenuation:false,depthTest:false}));dots.renderOrder=84;group.add(dots);}
   panel.dataset.pair=row.source+'|'+row.target;
  }
  for(const row of ranked.slice(0,12)){const button=document.createElement('button');button.type='button';button.dataset.contactPair=row.source+'|'+row.target;button.style.cssText='display:block;text-align:left;width:100%;margin:5px 0;white-space:normal';button.textContent=bodyName(row.source)+' ↔ '+bodyName(row.target)+'：'+(labels[row.status]||row.status)+(row.status==='gap'?' '+number(row.distance)+' mm':row.status==='interference'?' '+number(row.volume)+' mm³':'');button.onclick=()=>focus(row);panel.querySelector('[data-contact-rows]').append(button);}
  if(ranked[0])focus(ranked[0]);
 }
 return {clear,pending,show};
}
