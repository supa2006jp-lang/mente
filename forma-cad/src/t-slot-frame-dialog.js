import {FRAME_LIMIT,frameAssembly,frameBill,measureFrameGeometry,framePartName,savedFrameAssembly} from './t-slot-frame.js';
import {framePrintPlates,saveFramePlates} from './t-slot-frame-print.js';

const mm=n=>Number(n.toFixed(6));
export function createTSlotFrameDialog({meshes,getFeatures,bodyName,kernel,commit,notify}) {
  const dialog=document.createElement('dialog');
  dialog.id='t-slot-frame-dialog';dialog.setAttribute('aria-labelledby','t-slot-title');
  dialog.innerHTML='<h2 id="t-slot-title">T溝フレームを配置</h2><label>基準の立方体・直方体<select id="t-slot-source"></select></label>'+
    '<p>28 mm角のフレームを各辺に合わせて作ります。1本の上限は'+FRAME_LIMIT+' mmです。長い辺は等分し、継ぎ目をプレートで固定します。支柱は上下の横材の端まで通るため、基準の高さに56 mmを足した長さです。</p>'+
    '<table id="t-slot-lengths" hidden><caption>1辺あたりのフレーム寸法</caption><thead><tr><th scope="col">方向</th><th scope="col">必要長</th><th scope="col">1本の長さ × 本数</th></tr></thead><tbody></tbody></table>'+
    '<p id="t-slot-summary" role="status"></p><div class="export-actions"><button type="button" data-close>閉じる</button><button type="button" id="t-slot-apply" class="accent">配置する</button></div>';
  document.body.append(dialog);
  const target=dialog.querySelector('select'),summary=dialog.querySelector('[role=status]'),apply=dialog.querySelector('#t-slot-apply');
  const lengths=dialog.querySelector('#t-slot-lengths');
  let original=null,editing=null,revision=0,busy=false;
  function inspect(){
    apply.disabled=true;lengths.hidden=true;
    if(!meshes.has(target.value)){summary.textContent='基準にする立方体または直方体を作成してください。';return;}
    try{
      const box=measureFrameGeometry(meshes.get(target.value).geometry),assembly=frameAssembly(box);
      const rails=assembly.parts.filter(p=>p.kind==='rail').length;
      lengths.tBodies[0].replaceChildren(...assembly.runs.map((run,i)=>{
        const row=document.createElement('tr'),axis=document.createElement('th');
        axis.scope='row';axis.textContent=['幅','奥行き','支柱'][i];row.append(axis);
        row.insertCell().textContent=mm(run.span)+' mm';
        row.insertCell().textContent=mm(run.length)+' mm × '+run.count+'本';
        return row;
      }));
      lengths.hidden=false;
      summary.textContent='基準寸法 '+box.size.map(mm).join(' × ')+' mm ／ フレーム '+rails+'本、固定治具 '+(assembly.parts.length-rails)+'個。'+
        (assembly.parts.some(p=>p.keyed)?' 20 mm未満の横材はキー付きプレートをT溝に差し込み、両側の柱にM8で固定します。':'');
      apply.disabled=false;
    }catch(error){summary.textContent=error.message;}
  }
  target.onchange=inspect;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(!dialog.open){revision++;original=null;busy=false;}});
  apply.onclick=async()=>{
    if(busy||!original||apply.disabled)return;
    const before=original,token=++revision,current=()=>dialog.open&&revision===token&&getFeatures()===before;
    if(!current()){summary.textContent='モデルが変更されました。開き直してください。';return;}
    const existing=editing??before.find(f=>f.spec?.type==='tSlotFrame'&&f.spec.target===target.value);
    const spec={type:'tSlotFrame',id:existing?.id??crypto.randomUUID(),target:target.value};
    const prefix=existing?before.slice(0,before.indexOf(existing)):before;
    busy=true;target.disabled=apply.disabled=true;summary.textContent='フレームと固定治具を配置しています…';
    try{
      const result=await kernel.run(prefix,spec);
      if(!current())return;
      const entry={...existing,kind:'cadop',id:spec.id,name:'T溝フレーム',spec,...result};
      let next=existing?before.map(f=>f===existing?entry:f):[...before,entry];
      if(existing&&prefix.length+1<next.length)next=(await kernel.run(next,{type:'replay',before,start:prefix.length+1})).features;
      if(!current())return;
      commit(next);dialog.close();notify('外周12辺にフレームを配置しました。「出力」で印刷プレートを確認できます。');
    }catch(error){if(current())summary.textContent=error.message;}
    finally{if(revision===token){busy=false;target.disabled=false;apply.disabled=false;}}
  };
  return {
    open(selected,feature=null){
      original=getFeatures();editing=feature;revision++;busy=false;target.disabled=false;
      const generated=new Set(original.filter(f=>f.spec?.type==='tSlotFrame').flatMap(f=>f.outputs.map(o=>o.id)));
      target.replaceChildren(...[...meshes.keys()].filter(id=>!generated.has(id)).map(id=>new Option(bodyName(id),id)));
      const id=feature?.spec.target??selected;
      if([...target.options].some(o=>o.value===id))target.value=id;
      apply.textContent=feature?'配置を更新':'配置する';
      dialog.showModal();inspect();
    },
    close(){if(dialog.open)dialog.close();}
  };
}

function drawFootprints(canvas,plate) {
  const ctx=canvas.getContext('2d'),scale=canvas.width/180;
  ctx.setTransform(scale,0,0,-scale,0,canvas.height);ctx.fillStyle='#f4f7f8';ctx.fillRect(0,0,180,180);
  const colors={rail:'#718492',corner:'#138078',splice:'#138078',strap:'#138078',bolt:'#4b535d',nut:'#b68133'};
  for(const {part,min,max} of plate.placements) {
    ctx.fillStyle=colors[part.kind];
    ctx.fillRect(min[0],min[1],max[0]-min[0],max[1]-min[1]);
  }
}
function frameOutputEntry(frames,label,{download,name,isCurrent,notify}) {
  const assemblies=frames.map(f=>savedFrameAssembly(f.analysis));
  const assembly={parts:assemblies.flatMap(a=>a.parts),fixings:assemblies.reduce((sum,a)=>sum+a.fixings,0)};
  let bolts,nuts,select,canvas,layout,plates;
  const redraw=()=>{if(plates?.length)drawFootprints(canvas,plates[Number(select.value)||0]);};
  return {
    label,rows:[],action:'プレートを保存',
    controls(panel,refresh){
      panel.innerHTML='<div class="t-slot-quantities"><label>追加ボルト（個）<input type="number" id="t-slot-extra-bolts" min="0" max="10000" step="1" value="0" required></label>'+
        '<label>追加ナット（個）<input type="number" id="t-slot-extra-nuts" min="0" max="10000" step="1" value="0" required></label></div>'+
        '<p>取付に使うボルト・ナットは各'+assembly.fixings+'個含まれます。</p>'+
        '<div class="t-slot-plate"><label>印刷プレート<select id="t-slot-print-plate"></select></label><canvas width="240" height="240" aria-label="180 mm四方のプレート上で各部品が占める範囲"></canvas></div>';
      [bolts,nuts]=panel.querySelectorAll('input');select=panel.querySelector('select');canvas=panel.querySelector('canvas');layout=panel.querySelector('.t-slot-plate');
      bolts.oninput=nuts.oninput=refresh;select.onchange=redraw;
    },
    async load(){
      layout.hidden=true;
      const bill=frameBill(assembly,bolts.valueAsNumber,nuts.valueAsNumber);
      plates=framePrintPlates(bill);
      select.replaceChildren(...plates.map((p,i)=>new Option((i+1)+' / '+plates.length+' 枚目（'+p.placements.length+'部品）',i)));
      layout.hidden=false;redraw();
      return {rows:bill.map(p=>({label:framePartName(p)+' × '+p.count})),data:plates,
        action:plates.length===1?'3MFを保存':'全'+plates.length+'枚をZIPで保存',
        detail:'180 × 180 mm ／ A1 mini・PETG。'+(plates.length===1?'部品を並べた3MFを保存します。':'プレートごとの3MFを1つのZIPにまとめます。')};
    },
    async run(data){
      try{
        const saved=await saveFramePlates(data,{download,isCurrent,name:name+'-T溝フレーム',progress:(n,total)=>notify('印刷プレートを作成中 '+n+' / '+total)});
        if(saved)notify(data.length+'枚のフレーム部品プレートを出力しました。');
      }catch(error){notify('フレーム部品を出力できませんでした。'+error.message);}
    }
  };
}
export function frameOutputEntries(frames,options) {
  const {bodyName}=options;
  return [...(frames.length>1?[frameOutputEntry(frames,'全てのT溝フレーム',options)]:[]),
    ...frames.map(f=>frameOutputEntry([f],bodyName(f.spec.target)+' の外周フレーム',options))];
}
