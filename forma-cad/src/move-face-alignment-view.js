import * as THREE from 'three';
import {createMoveGhost,disposeMoveGhost} from './move-cursor.js';
import {findPanelSpace,projectedBounds} from './panel-placement.js';

export function createMoveFaceAlignmentView({scene,camera,canvas,host,panel,getBodyName,getObjects,onReselect}){
 const layer=document.createElement('div');
 layer.id='move-face-alignment-labels';
 layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:9';
 host.append(layer);
 const records=new Map(),colors={source:0x2574da,target:0xdf8b14};
 const angleLabel=document.createElement('span');
 angleLabel.id='move-face-alignment-angle';angleLabel.hidden=true;
 angleLabel.style.cssText='position:absolute;white-space:nowrap;padding:5px 8px;border:2px solid #008ca3;border-radius:6px;background:#eafcff;color:#006677;font:700 13px sans-serif;box-shadow:0 2px 6px #1233';
 angleLabel.title='今回の面合わせで回転する角度';
 layer.append(angleLabel);
 let frame=null,ghost=null,angleAnchor=null;

 function removeRecord(role){
  const record=records.get(role);
  if(!record)return;
  record.object.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
  record.object.removeFromParent();record.label.remove();records.delete(role);
 }
 function clearPreview(){
  disposeMoveGhost(ghost);ghost=null;delete host.dataset.moveFaceAlignmentPreview;
  angleLabel.hidden=true;angleAnchor=null;
 }
 function syncState(){
  const state={};
  for(const [role,record] of records)state[role]={key:record.face.key,bodyId:record.face.mesh.userData.bodyId,selected:record.selected};
  if(records.size)host.dataset.moveFaceAlignment=JSON.stringify(state);else delete host.dataset.moveFaceAlignment;
 }
 function update(){
  frame=null;
  if(!records.size)return;
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
  const placed=getObjects().map(object=>projectedBounds(object,camera,rect.width,rect.height)).filter(Boolean);
  if(!panel.hidden)placed.push({left:panelRect.left-rect.left,right:panelRect.right-rect.left,top:panelRect.top-rect.top,bottom:panelRect.bottom-rect.top});
  const labels=[];
  for(const record of records.values()){
   const {face,object,label,anchor}=record;
   face.mesh.updateWorldMatrix(true,false);object.matrix.copy(face.mesh.matrixWorld);object.matrixWorldNeedsUpdate=true;
   labels.push({label,point:anchor.clone().applyMatrix4(object.matrix).project(camera)});
  }
  if(angleAnchor)labels.push({label:angleLabel,point:angleAnchor.clone().project(camera)});
  for(const {label,point} of labels){
   label.hidden=point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;
   if(label.hidden)continue;
   const position=findPanelSpace({width:rect.width,height:rect.height,panelWidth:label.offsetWidth,panelHeight:label.offsetHeight,
    anchor:{x:(point.x+1)*rect.width/2,y:(1-point.y)*rect.height/2},obstacles:placed,margin:4,gap:8});
   label.hidden=!position;
   if(!position)continue;
   const {x,y}=position;
   label.style.left=x+rect.left-base.left+'px';label.style.top=y+rect.top-base.top+'px';
   placed.push({left:x,right:x+label.offsetWidth,top:y,bottom:y+label.offsetHeight});
  }
  frame=requestAnimationFrame(update);
 }
 function setFace(role,face,{selected=true}={}){
  if(!face){removeRecord(role);syncState();return;}
  let record=records.get(role);
  if(record?.face.key!==face.key){
   removeRecord(role);
   const geometry=face.outline(),color=colors[role];
   geometry.computeBoundingBox();
   const object=new THREE.Group();object.matrixAutoUpdate=false;
   const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
   const border=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color,depthTest:false}));
   fill.renderOrder=7;border.renderOrder=8;object.add(fill,border);scene.add(object);
   const label=document.createElement('button');label.type='button';
   label.dataset.alignmentRole=role;
   label.style.cssText='position:absolute;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 7px;border:2px solid #'+color.toString(16).padStart(6,'0')+';border-radius:6px;background:#fffffff2;color:#18445d;font:600 12px sans-serif;box-shadow:0 2px 6px #1233';
   layer.append(label);
   record={face,object,label,anchor:geometry.boundingBox.getCenter(new THREE.Vector3()),selected};records.set(role,record);
   label.onclick=()=>{if(record.selected)onReselect(role);};
  }
  record.selected=selected;
  record.label.textContent=(role==='source'?'① 動かす面':'② 基準面')+' · '+getBodyName(face.mesh.userData.bodyId)+(selected?'':'（候補）');
  record.label.title=selected?'クリックしてこの面だけ選び直す':'面をクリックして選択';
  record.label.tabIndex=selected?0:-1;
  record.label.style.pointerEvents=selected?'auto':'none';
  record.label.style.cursor=selected?'pointer':'default';
  syncState();
  if(frame===null)update();
 }
 function setAngle(angle,pivot,{preview=false}={}){
  const degrees=Number(THREE.MathUtils.radToDeg(angle).toFixed(3));
  const text=degrees<0?'−'+Math.abs(degrees):degrees>0?'＋'+degrees:'0';
  angleLabel.textContent=(preview?'回転後 ':'面合わせ ')+text+'°';
  angleLabel.hidden=false;angleAnchor=pivot.clone();
  if(frame===null)update();
 }
 function preview(proxy,axis,angle){
  clearPreview();
  proxy.updateMatrixWorld(true);
  ghost=createMoveGhost(proxy);
  const pivot=proxy.getWorldPosition(new THREE.Vector3()),turn=new THREE.Matrix4().makeRotationAxis(axis,angle);
  turn.setPosition(pivot.clone().sub(pivot.clone().applyMatrix4(turn)));
  ghost.matrix.copy(proxy.matrixWorld).premultiply(turn);
  ghost.traverse(object=>{
   if(!object.material)return;
   for(const material of [].concat(object.material))material.depthTest=false;
   object.renderOrder=9;
  });
  scene.add(ghost);ghost.updateMatrixWorld(true);
  setAngle(angle,pivot,{preview:true});
  host.dataset.moveFaceAlignmentPreview=JSON.stringify({angle:THREE.MathUtils.radToDeg(angle),axis:axis.toArray(),pivot:pivot.toArray(),matrix:ghost.matrixWorld.toArray()});
 }
 function clear(){
  clearPreview();
  for(const role of [...records.keys()])removeRecord(role);
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  syncState();
 }
 return {setFace,setAngle,preview,clearPreview,clear};
}
