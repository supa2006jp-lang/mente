import * as THREE from 'three';

export function createJoinPreviewView({scene,host,fields,dialog,getBodyName}){
 let panel=null,overlay=null,pending=null;
 function clear(){pending?.(false);pending=null;panel?.remove();panel=null;overlay?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay?.removeFromParent();overlay=null;delete host.dataset.joinPreview;}
 function show(result,spec){
  clear();if(spec.type!=='join'||spec.combineMode!=='結合')return;
  const rows=result.analysis?.connectionCheck?.bodies;if(!rows?.length)return;
  const count=rows.reduce((n,r)=>n+r.count,0);panel=document.createElement('section');panel.id='join-result-preview';panel.setAttribute('aria-label','結合結果の確認');panel.style.cssText='margin:12px 0;padding:12px;border:2px solid '+(count===1?'#2bbba2':'#e8aa46')+';border-radius:6px';
  const title=document.createElement('strong');title.textContent=count===1?'一体化できます：結合後は1つの塊':'結合後も '+count+' つの塊が残ります';panel.append(title);
  const note=document.createElement('p');note.textContent=[...new Set([spec.target,...(spec.others||[spec.other])])].map(getBodyName).join(' ＋ ')+(spec.keepTools==='保持'?'。ツールボディは別に保持します。':'。')+(count>1?'色枠が分離した塊の場所です。戻って位置を調整するか、分離したまま保持するか選べます。':'実行で確定します。');panel.append(note);
  if(count>1){overlay=new THREE.Group();let i=0;for(const row of rows)for(const bounds of row.parts||[]){const color=[0xe0a12c,0x259ac5,0xbe6dcd,0x59ab71][i++%4],box=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1])).expandByScalar(.03),helper=new THREE.Box3Helper(box,color);helper.material.depthTest=false;helper.renderOrder=110;overlay.add(helper);}scene.add(overlay);}
  fields.append(panel);host.dataset.joinPreview=JSON.stringify({count,partial:rows.some(r=>r.partial)});return count;
 }
 async function confirm(result,spec,isCurrent){
  const count=show(result,spec);if(!(count>1))return isCurrent();
  return new Promise(resolve=>{
   let finished=false;const finish=value=>{if(finished)return;finished=true;pending=null;dialog.removeEventListener('close',cancel);fields.removeEventListener('input',cancel);fields.removeEventListener('change',cancel);actions.remove();resolve(value&&isCurrent());},cancel=()=>finish(false);
   const actions=document.createElement('div');actions.className='workspace-actions';const back=document.createElement('button'),keep=document.createElement('button');back.type=keep.type='button';back.id='join-preview-back';keep.id='join-preview-keep';back.textContent='戻って位置を調整';keep.textContent='分離したまま確定';keep.style.cssText='background:#ab6516;color:white;border:2px solid #edb44f';back.onclick=cancel;keep.onclick=()=>finish(true);actions.append(back,keep);panel.append(actions);pending=finish;dialog.addEventListener('close',cancel,{once:true});fields.addEventListener('input',cancel,{once:true});fields.addEventListener('change',cancel,{once:true});
  });
 }
 return {show,clear,confirm};
}
