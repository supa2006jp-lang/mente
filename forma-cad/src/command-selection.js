export function commandAvailability(type,state){
 const bodies=state.bodies||0,selected=state.bodyIds?.length||0;
 if(type==='move'&&state.sketchMoveSelection)return {enabled:true,reason:'選択した線につながるスケッチをまとめて移動します。'};
 if(type==='mirror'&&(state.sketchSelection||!bodies&&state.sketches))return {enabled:true,reason:state.sketchSelection?'スケッチの選択を引き継ぎます。ミラーの基準を指定してください。':'スケッチ図形を選択してミラーできます。'};
 if(['fillet','chamfer','shell','join','split','enclose','coilJoint','move','pull','trimSurface','mirror','circular','rectangular','thread','ballJoint','bossJoint','cylinderHinge','snapLid','slideLid'].includes(type)&&!bodies)return {enabled:false,reason:'先にソリッドを作成または読み込んでください。'};
 if(type==='join'&&bodies<2)return {enabled:false,reason:'結合・切り取りには2つ以上のボディが必要です。'};
 if(type==='thread'&&!state.cylinder)return {enabled:false,reason:'円柱の側面または穴の内壁を選択してください。'};
 if(type==='pull'&&!state.faces&&!state.cylinder)return {enabled:false,reason:'動かす平面または円筒面を選択してください。'};
 return {enabled:true,reason:state.edges?state.edges+' 辺の選択を引き継ぎます。':state.faces?state.faces+' 面の選択を引き継ぎます。':selected?selected+' ボディの選択を引き継ぎます。'+(selected>1&&!['join','move','fillet','chamfer','mirror'].includes(type)?'このコマンドの対象は欄で1つ指定します。':''):'対象を画面またはコマンド内で選択できます。'};
}
export function installCommandSelection({getState,notify}){
 const summaryWidth=document.getElementById('selection-summary');if(summaryWidth)summaryWidth.style.cssText+=';display:inline-block;width:130px;flex:0 0 130px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
 const mappings={'direct-fillet':'fillet','direct-chamfer':'chamfer','shell-tool':'shell','join-tool':'join','split-tool':'split','move-tool':'move','direct-thread':'thread','direct-pull':'pull','ball-joint-tool':'ballJoint','boss-joint-tool':'bossJoint','cylinder-hinge-tool':'cylinderHinge','snap-lid-tool':'snapLid','slide-lid-tool':'slideLid'};
 const context=document.createElement('p');context.id='command-selection-context';context.setAttribute('role','status');context.style.cssText='font-size:13px;line-height:1.5;color:#a9d6df';document.getElementById('cad-help').after(context);
 let signature='';
 function sync(){
  const state=getState(),type=document.getElementById('cad-command').value,key=JSON.stringify([state,type]);if(key===signature)return;signature=key;
  const summary=document.getElementById('selection-summary');if(summary){summary.title=state.bodyIds?.length?'対象：'+state.bodyIds.map(id=>state.names?.[id]||id).join('、'):state.edges?'選択した辺を対象にします':state.faces?'選択した面を対象にします':'画面でボディ・面・辺を選択できます';summary.setAttribute('aria-live','polite');}
  for(const [id,type] of Object.entries(mappings)){const button=document.getElementById(id);if(!button)continue;const result=commandAvailability(type,state);button.dataset.selectionCommand=type;button.setAttribute('aria-disabled',String(!result.enabled));button.title=result.reason;button.style.opacity=result.enabled?'':'.5';}
  const result=commandAvailability(type,state);context.textContent=(state.edges?'辺 '+state.edges:state.faces?'面 '+state.faces:state.sketchSelection?'スケッチ '+state.sketchSelection:state.bodyIds?.length?'ボディ '+state.bodyIds.length:'選択なし')+' ／ '+result.reason;
 }
 document.addEventListener('click',event=>{const button=event.target.closest('[data-selection-command]');if(!button)return;const result=commandAvailability(button.dataset.selectionCommand,getState());if(!result.enabled){event.preventDefault();event.stopImmediatePropagation();notify(result.reason);}},{capture:true});
 document.getElementById('cad-command').addEventListener('change',()=>{signature='';sync();});
 return {sync};
}
