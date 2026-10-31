import {KernelClient} from './kernel-client.js';
import * as THREE from 'three';
import {compactKernelData} from './kernel-transfer.js';

export function createInteriorEdgeTool({container,getFeatures,getSelectionKey,onSelect,notify}){
 const kernel=new KernelClient(),button=document.createElement('button'),status=document.createElement('small');
 button.id='select-interior-edges';button.type='button';button.hidden=true;button.textContent='内側の辺をまとめて選択';button.title='上面（＋Z）が開いた入れ物の、底の角・縦の角などを選択します。外周と開口のふちは含みません。';
 button.style.cssText='pointer-events:auto;width:100%;margin-top:7px;background:#ddf3f7;color:#17475a;border-color:#79b1c8';
 status.id='interior-edge-selection-status';status.setAttribute('role','status');status.style.cssText='display:block;font-size:12px;line-height:1.6;margin-top:5px';container.append(button,status);
 let ids=[],queryIds=[],busy=false,revision=0,original=null,selectionKey=null,statusKey=null;
 function stop(){++revision;kernel.reset();busy=false;button.textContent='内側の辺をまとめて選択';}
 button.onclick=async()=>{
  if(busy){stop();status.textContent='選択の検査を中止しました';return;}
  if(!ids.length)return;const targets=[...ids],current=++revision;queryIds=targets;original=getFeatures();selectionKey=getSelectionKey();statusKey=selectionKey;busy=true;button.textContent='内側の辺の検査を中止';status.textContent='入れ物の内側を調べています…';
  try{
   const result=await kernel.run(compactKernelData(original),{type:'interiorEdges',targets},{onProgress:p=>{if(current===revision&&p.stage)status.textContent=p.stage;}});
   if(current!==revision||getFeatures()!==original||getSelectionKey()!==selectionKey)return;
   if(!result.edges?.length){status.textContent='上面が開いた底付きの空間に、選択できる角のある辺が見つかりません。元の選択は残しています。';return;}
   busy=false;onSelect(result.edges,result.analysis.interiorEdges);statusKey=getSelectionKey();status.textContent=result.edges.length+' 辺を選択しました（外周・開口のふちを除く）';notify('内側の '+result.edges.length+' 辺を選択しました。フィレット・面取りに使用できます');
  }catch(e){if(current===revision)status.textContent=e.message;}
  finally{if(current===revision){busy=false;button.textContent='内側の辺をまとめて選択';}}
 };
 return {update(next,enabled){
  if(busy&&(getFeatures()!==original||getSelectionKey()!==selectionKey||JSON.stringify(queryIds)!==JSON.stringify(next)||!enabled)){stop();status.textContent='選択が変わったため検査を中止しました';}
  if(!busy&&statusKey!==null&&(getSelectionKey()!==statusKey||getFeatures()!==original)){status.textContent='';statusKey=null;}
  ids=[...next];button.hidden=!(enabled&&ids.length);status.hidden=button.hidden;
 },cancel(){if(busy)stop();status.textContent='';},get busy(){return busy;}};
}

// A native curved edge and a clicked display chord have different IDs. Keep
// Ctrl-click removal available without expanding the selected curve to a whole
// body or adding it a second time.
export function matchesInteriorEdge(a,b){
 if(!a.nativeReference||a.bodyId!==b.bodyId)return false;
 const points=(a.curve||a.arc||a.circle)?.points||[a.a,a.b],p=b.point;
 let best=Infinity;for(let i=1;i<points.length;i++){const x=points[i-1],y=points[i],d=y.map((v,k)=>v-x[k]),n=d.reduce((s,v)=>s+v*v,0),t=Math.max(0,Math.min(1,n?d.reduce((s,v,k)=>s+(p[k]-x[k])*v,0)/n:0));best=Math.min(best,Math.hypot(...p.map((v,k)=>v-x[k]-t*d[k])));}
 return best<.025;
}

export function pickedInteriorEdge(edges,camera,rect,x,y){
 const cursor=new THREE.Vector2(x-rect.left,y-rect.top);let nearest=null,best=8;
 for(const edge of edges){if(!edge.nativeReference)continue;const points=(edge.curve||edge.arc||edge.circle)?.points||[edge.a,edge.b];
  for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]).project(camera),b=new THREE.Vector3(...points[i]).project(camera);if(Math.min(a.z,b.z)>1||Math.max(a.z,b.z)<-1)continue;const p=new THREE.Vector2((a.x+1)*rect.width/2,(1-a.y)*rect.height/2),q=new THREE.Vector2((b.x+1)*rect.width/2,(1-b.y)*rect.height/2),d=q.clone().sub(p),t=Math.max(0,Math.min(1,d.lengthSq()?cursor.clone().sub(p).dot(d)/d.lengthSq():0)),distance=p.addScaledVector(d,t).distanceTo(cursor);if(distance<best){best=distance;nearest=edge;}}
 }
 return nearest;
}
