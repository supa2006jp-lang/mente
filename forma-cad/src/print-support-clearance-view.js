import * as THREE from 'three';

export function createSupportClearanceView({anchor,host,camera}){
 const panel=document.createElement('section');
 panel.dataset.id='support-clearance';
 panel.style.cssText='margin:10px 0;padding:8px;border-left:3px solid #d66910;background:#fff5e8';
 anchor.after(panel);
 const labels=document.createElement('div');
 labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
 host.append(labels);
 const detail=document.createElement('small');
 detail.setAttribute('aria-live','polite');
 const projected=new THREE.Vector3();
 let group,items=[];

 function clear(){
  group?.removeFromParent();
  for(const {outline} of items)outline.dispose();
  group=null;items=[];panel.hidden=true;panel.replaceChildren();labels.replaceChildren();
 }

 function select(index){
  for(const [i,item] of items.entries()){
   const active=i===index;
   item.outline.material.opacity=active?1:.65;
   item.marker.setAttribute('aria-pressed',active);
   item.button.setAttribute('aria-pressed',active);
   item.marker.style.boxShadow=active?'0 0 0 3px #ed933c':'0 1px 4px #0005';
   item.button.style.background=active?'#ffd9b4':'';
  }
  detail.textContent=items[index].description;
 }

 function sync(){
  for(const {center,marker} of items){
   projected.copy(center).project(camera);
   const {x,y,z}=projected;
   marker.hidden=z<-1||z>1||Math.abs(x)>1||Math.abs(y)>1;
   if(!marker.hidden){
    marker.style.left=(x+1)*50+'%';marker.style.top=(1-y)*50+'%';
   }
  }
 }

 function show(regions,parent){
  clear();
  if(!regions.length)return;
  group=new THREE.Group();parent.add(group);panel.hidden=false;
  const heading=document.createElement('strong');heading.textContent='薄皮が収まらない箇所';
  const list=document.createElement('div');list.style.cssText='display:flex;gap:4px;flex-wrap:wrap;max-height:110px;overflow:auto;margin:6px 0';
  detail.textContent='画面の橙色の番号を押すと、確保できる高さと薄皮の厚さを表示します。';
  panel.append(heading,list,detail);
  const mm=value=>Number(value.toFixed(4))+' mm';
  items=regions.map((region,index)=>{
   const box=new THREE.Box3(...region.bounds.map(point=>new THREE.Vector3(...point)));
   const center=box.getCenter(new THREE.Vector3());
   if(box.max.z-box.min.z<.12){box.min.z=center.z-.06;box.max.z=center.z+.06;}
   const outline=new THREE.Box3Helper(box,0xf37920);
   outline.material.depthTest=false;outline.material.depthWrite=false;
   outline.material.transparent=true;outline.material.opacity=.65;outline.renderOrder=14;
   group.add(outline);
   const title=(index+1)+' '+(region.role==='lower'?'底面':'上面');
   const description=title+' ／ '+(region.available==null?'確保できる高さを特定できません':'確保できる高さ '+mm(region.available))+' ／ 薄皮 '+mm(region.thickness)+'。'+(region.partial?'干渉した範囲だけ見送りました。':'この下面への配置を見送りました。');
   const makeButton=()=>{const button=document.createElement('button');button.type='button';button.title=description;button.setAttribute('aria-pressed','false');button.onclick=()=>select(index);return button;};
   const button=makeButton();button.textContent=title;list.append(button);
   const marker=makeButton();marker.dataset.supportClearanceMarker=String(index+1);marker.textContent=String(index+1);
   marker.setAttribute('aria-label',title+'の薄皮の干渉を確認');
   marker.style.cssText='position:absolute;transform:translate(-50%,-50%);pointer-events:auto;padding:3px 7px;border:2px solid white;border-radius:6px;color:white;background:#ab4b06;font-size:12px;box-shadow:0 1px 4px #0005';
   labels.append(marker);
   return {outline,center,button,marker,description};
  });
  sync();
 }

 clear();return {show,clear,sync};
}
