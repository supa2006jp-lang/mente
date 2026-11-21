import {FRAME_LIMIT,frameAssembly,frameBill,frameOpeningSize,measureFrameGeometry,framePartName,savedFrameAssembly} from './t-slot-frame.js';
import {framePrintPlates,saveFramePlates} from './t-slot-frame-print.js';
import {estimateFrameFilament} from './t-slot-filament.js';
import {manualFrameBill,mergeFrameBill,preferredRailLimit,rememberRailLimit} from './t-slot-parts.js';
import {framePanels,PANEL_HOLE_RADIUS} from './t-slot-panels.js';
import {manualControls,bindManualControls,panelControls,bindPanelControls} from './t-slot-print-options.js';

const mm=n=>Number(n.toFixed(6));
function savedPartsSettings(frame){
  if(!frame)return {};
  const version=frame.analysis.tSlotSizingVersion??1;
  return {opening:frameOpeningSize(frame.analysis.tSlotBox,version),sizingVersion:version,maxRailLength:frame.spec.maxRailLength??FRAME_LIMIT};
}
export function createTSlotFrameDialog({meshes,getFeatures,bodyName,kernel,commit,notify,openParts}) {
  const dialog=document.createElement('dialog');
  dialog.id='t-slot-frame-dialog';dialog.setAttribute('aria-labelledby','t-slot-title');
  dialog.innerHTML='<h2 id="t-slot-title">T溝フレームを配置</h2><label>基準の立方体・直方体<select id="t-slot-source"></select></label>'+
    '<label>フレーム1本の長さの上限（mm）<input id="t-slot-rail-limit" type="number" max="180" step="any" required></label>'+
    '<p>28 mm角のフレームを各辺に合わせて作ります。長い辺は等分し、継ぎ目を長さ45 mmの2穴プレートで固定します。支柱は基準の高さに56 mmを足した長さです。</p>'+
    '<table id="t-slot-lengths" hidden><caption>1辺あたりのフレーム寸法</caption><thead><tr><th scope="col">方向</th><th scope="col">必要長</th><th scope="col">1本の長さ × 本数</th></tr></thead><tbody></tbody></table>'+
    '<p id="t-slot-summary" role="status"></p><div class="export-actions"><button type="button" id="t-slot-parts-only">部品単体・設定</button><button type="button" data-close>閉じる</button><button type="button" id="t-slot-apply" class="accent">配置する</button></div>';
  document.body.append(dialog);
  const target=dialog.querySelector('select'),summary=dialog.querySelector('[role=status]'),apply=dialog.querySelector('#t-slot-apply');
  const lengths=dialog.querySelector('#t-slot-lengths'),limit=dialog.querySelector('#t-slot-rail-limit'),partsOnly=dialog.querySelector('#t-slot-parts-only');
  let original=null,editing=null,measuredBox=null,revision=0,busy=false;
  const targetFrame=()=>editing?.spec.target===target.value?editing:original?.find(f=>f.spec?.type==='tSlotFrame'&&f.spec.target===target.value);
  function inspect(){
    apply.disabled=true;lengths.hidden=true;measuredBox=null;
    if(!meshes.has(target.value)){summary.textContent='基準にする立方体または直方体を作成してください。';return;}
    try{
      const box=measureFrameGeometry(meshes.get(target.value).geometry);
      measuredBox=box;
      const assembly=frameAssembly(box,undefined,limit.valueAsNumber);
      const rails=assembly.parts.filter(p=>p.kind==='rail').length;
      lengths.tBodies[0].replaceChildren(...assembly.runs.map((run,i)=>{
        const row=document.createElement('tr'),axis=document.createElement('th');
        axis.scope='row';axis.textContent=['幅','奥行き','支柱'][i];row.append(axis);
        row.insertCell().textContent=mm(run.span)+' mm';
        row.insertCell().textContent=mm(run.length)+' mm × '+run.count+'本';
        return row;
      }));
      lengths.hidden=false;
      const inside=assembly.parts.filter(p=>p.mount==='inside').length,outside=assembly.parts.filter(p=>p.mount==='outside').length;
      summary.textContent='基準寸法 '+box.size.map(mm).join(' × ')+' mm ／ フレーム '+rails+'本、固定治具 '+(inside+outside)+'個（内側'+inside+'個・外側'+outside+'個）。'+
        (outside?' 内側に治具とボルトの取付スペースが足りない箇所は外側に配置します。':'')+
        (assembly.parts.some(p=>p.keyed)?' 20 mm未満の横材はキー付きプレートをT溝に差し込み、両側の柱にM8で固定します。':'')+
        (assembly.parts.some(p=>p.panelHole)?' 透明板用のM8ねじ穴は、枠の内角から縦横14 mmです。':'');
      apply.disabled=false;
    }catch(error){summary.textContent=error.message;}
  }
  function loadLimit(){
    const existing=targetFrame();
    limit.value=existing?(existing.spec.maxRailLength??FRAME_LIMIT):preferredRailLimit();
  }
  target.onchange=()=>{loadLimit();inspect();};limit.oninput=inspect;
  partsOnly.onclick=()=>{
    const settings=savedPartsSettings(targetFrame());
    if(measuredBox)settings.opening=frameOpeningSize(measuredBox,settings.sizingVersion);
    if(Number.isFinite(limit.valueAsNumber))settings.maxRailLength=limit.valueAsNumber;
    dialog.close();openParts(settings);
  };
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(!dialog.open){revision++;original=null;busy=false;}});
  apply.onclick=async()=>{
    if(busy||!original||apply.disabled)return;
    const before=original,token=++revision,current=()=>dialog.open&&revision===token&&getFeatures()===before;
    if(!current()){summary.textContent='モデルが変更されました。開き直してください。';return;}
    const existing=editing??targetFrame();
    const spec={type:'tSlotFrame',id:existing?.id??crypto.randomUUID(),target:target.value,maxRailLength:limit.valueAsNumber};
    const prefix=existing?before.slice(0,before.indexOf(existing)):before;
    busy=true;limit.disabled=partsOnly.disabled=target.disabled=apply.disabled=true;summary.textContent='フレームと固定治具を配置しています…';
    try{
      const result=await kernel.run(prefix,spec);
      if(!current())return;
      const entry={...existing,kind:'cadop',id:spec.id,name:'T溝フレーム',spec,...result};
      let next=existing?before.map(f=>f===existing?entry:f):[...before,entry];
      if(existing&&prefix.length+1<next.length)next=(await kernel.run(next,{type:'replay',before,start:prefix.length+1})).features;
      if(!current())return;
      commit(next);rememberRailLimit(spec.maxRailLength);dialog.close();notify('外周12辺にフレームを配置しました。「出力」で印刷プレートを確認できます。');
    }catch(error){if(current())summary.textContent=error.message;}
    finally{if(revision===token){busy=false;limit.disabled=partsOnly.disabled=target.disabled=apply.disabled=false;}}
  };
  return {
    open(selected,feature=null){
      original=getFeatures();editing=feature;revision++;busy=false;limit.disabled=partsOnly.disabled=target.disabled=false;
      const frames=original.filter(f=>f.spec?.type==='tSlotFrame'),owner=feature??frames.find(f=>f.outputs.some(o=>o.id===selected));
      const generated=new Set(frames.flatMap(f=>f.outputs.map(o=>o.id)));
      target.replaceChildren(...[...meshes.keys()].filter(id=>!generated.has(id)).map(id=>new Option(bodyName(id),id)));
      if(!target.options.length||(owner&&!meshes.has(owner.spec.target))){
        const source=owner??frames.find(f=>f.outputs.some(o=>meshes.has(o.id)));
        original=null;openParts(savedPartsSettings(source));return;
      }
      const id=owner?.spec.target??selected;
      if([...target.options].some(o=>o.value===id))target.value=id;
      apply.textContent=feature?'配置を更新':'配置する';
      loadLimit();dialog.showModal();inspect();
    },
    close(){if(dialog.open)dialog.close();}
  };
}

function drawFootprints(canvas,plate) {
  const ctx=canvas.getContext('2d'),scale=canvas.width/180;
  ctx.setTransform(scale,0,0,-scale,0,canvas.height);ctx.fillStyle='#f4f7f8';ctx.fillRect(0,0,180,180);
  const colors={rail:'#718492',bolt:'#4b535d',panelWasher:'#4b535d',nut:'#b68133',wideNut:'#b68133'};
  for(const {part,min,max,transform} of plate.placements) {
    if(part.kind==='panel'){
      const m=transform;ctx.save();ctx.transform(m[0],m[1],m[3],m[4],m[9],m[10]);ctx.beginPath();
      part.outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
      for(const [x,y] of part.holes){ctx.moveTo(x+PANEL_HOLE_RADIUS,y);ctx.arc(x,y,PANEL_HOLE_RADIUS,0,2*Math.PI);ctx.closePath();}
      ctx.fillStyle='#b9e7e9';ctx.fill('evenodd');ctx.strokeStyle='#287487';ctx.lineWidth=.8;ctx.stroke();ctx.restore();continue;
    }
    ctx.fillStyle=colors[part.kind]??'#138078';
    ctx.fillRect(min[0],min[1],max[0]-min[0],max[1]-min[1]);
  }
}
const filamentNumber=new Intl.NumberFormat('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1});
function filamentLabel(amount) {
  if(!amount)return '算出不可';
  return '約 '+filamentNumber.format(amount.grams)+' g（'+filamentNumber.format(amount.meters)+' m）';
}
function frameOutputEntry(frames,label,{download,name,isCurrent,notify,bodyName,opening,maxRailLength,sizingVersion,rememberOpening},printSettings) {
  const manual=!frames.length;
  const assemblies=frames.map(f=>savedFrameAssembly(f.analysis));
  const modelOpening=frames.length===1?frameOpeningSize(frames[0].analysis.tSlotBox,frames[0].analysis.tSlotSizingVersion??1):null;
  const assembly={parts:assemblies.flatMap(a=>a.parts),fixings:assemblies.reduce((sum,a)=>sum+a.fixings,0)};
  let bolts,shortBolts,nuts,select,canvas,layout,plates,estimate,totalLabel,totalAmount,plateAmount,clearAmount,thinRailNote,manualOrder,panelSelection;
  function redraw(){
    const index=select.selectedIndex;
    if(!plates?.[index])return;
    drawFootprints(canvas,plates[index]);
    plateAmount.textContent=filamentLabel(estimate.plates[index]);
  }
  return {
    label,rows:[],action:'プレートを保存',
    controls(panel,refresh){
      panel.innerHTML=(manual?manualControls:'<fieldset class="t-slot-extras"><legend>追加するM8部品</legend><div class="t-slot-quantities">'+
        '<label>ボルト（首下16 mm）<input type="number" id="t-slot-extra-bolts" min="0" max="10000" step="1" value="0" required></label>'+
        '<label>ボルト（首下10 mm）<input type="number" id="t-slot-extra-bolts-10" min="0" max="10000" step="1" value="0" required></label>'+
        '<label>T溝ナット<input type="number" id="t-slot-extra-nuts" min="0" max="10000" step="1" value="0" required></label></div></fieldset>'+
        '<p>フレームの取付用に、首下16 mmのボルト'+assembly.fixings+'本とT溝ナット'+assembly.fixings+'個を含みます。</p>')+panelControls(manual,modelOpening)+
        '<div class="t-slot-layout" hidden><div class="t-slot-plate"><div class="t-slot-print-fields">'+
        '<label>3MFのノズル径<select id="t-slot-print-nozzle"><option value="0.4">0.4 mm</option><option value="0.6">0.6 mm</option></select></label>'+
        '<label>印刷プレート<select id="t-slot-print-plate"></select></label></div><canvas width="240" height="240" aria-label="180 mm四方のプレート上で各部品が占める範囲"></canvas></div>'+
        '<section class="t-slot-filament" aria-labelledby="t-slot-filament-heading"><h3 id="t-slot-filament-heading">予想フィラメント使用量（0.6 mmノズル）</h3>'+
        '<dl aria-live="polite"><dt id="t-slot-total-label"></dt><dd id="t-slot-filament-total"></dd>'+
        '<dt hidden>うち透明PETG</dt><dd id="t-slot-filament-clear" hidden></dd><dt>表示中のプレート</dt><dd id="t-slot-filament-plate"></dd></dl>'+
        '<p>PETG（径1.75 mm）・積層0.18 mm・壁4周・インフィル30%。フレームのあるプレートは5 mmのブリムを含みます。</p>'+
        '<p id="t-slot-thin-rail" hidden>長さ0.15 mm未満のフレームは、この設定の初層でスライスできません。</p></section></div>';
      if(manual)manualOrder=bindManualControls(panel,refresh,maxRailLength);
      else{
        bolts=panel.querySelector('#t-slot-extra-bolts');shortBolts=panel.querySelector('#t-slot-extra-bolts-10');
        nuts=panel.querySelector('#t-slot-extra-nuts');
        bolts.oninput=shortBolts.oninput=nuts.oninput=refresh;
      }
      panelSelection=bindPanelControls(panel,refresh,{opening,rememberOpening});
      const nozzle=panel.querySelector('#t-slot-print-nozzle');
      nozzle.value=String(printSettings.nozzle);nozzle.onchange=()=>{printSettings.nozzle=Number(nozzle.value);};
      select=panel.querySelector('#t-slot-print-plate');
      canvas=panel.querySelector('canvas');layout=panel.querySelector('.t-slot-layout');
      totalLabel=panel.querySelector('#t-slot-total-label');totalAmount=panel.querySelector('#t-slot-filament-total');
      clearAmount=panel.querySelector('#t-slot-filament-clear');
      plateAmount=panel.querySelector('#t-slot-filament-plate');thinRailNote=panel.querySelector('#t-slot-thin-rail');
      select.onchange=redraw;
    },
    async load(){
      layout.hidden=true;
      const index=Math.max(0,select.selectedIndex);
      const individual=manual?manualFrameBill(manualOrder.lines(),manualOrder.limit.valueAsNumber):[];
      let base=manual?[]:frameBill(assembly,bolts.valueAsNumber,nuts.valueAsNumber,shortBolts.valueAsNumber);
      const faces=panelSelection.selected(),panelOrders=[];
      if(faces.length){
        if(manual){
          const box=panelSelection.box();
          const version=opening?.every((n,i)=>n===box.size[i])?sizingVersion:undefined;
          const frame=frameAssembly(box,version,manualOrder.limit.valueAsNumber);
          if(panelSelection.includeFrame())base=frameBill(frame);
          panelOrders.push(framePanels(box,frame,faces));
        }else for(const [i,frame] of frames.entries()){
          const order=framePanels(frame.analysis.tSlotBox,assemblies[i],faces);
          order.plans.forEach(plan=>{plan.source=bodyName(frame.spec.target);});panelOrders.push(order);
        }
      }
      const bill=mergeFrameBill(base,individual,...panelOrders.map(p=>p.bill)),plans=panelOrders.flatMap(p=>p.plans);
      if(!bill.length)throw Error('印刷する部品の数量を入力するか、透明板の面を選んでください。');
      plates=framePrintPlates(bill);
      estimate=estimateFrameFilament(plates);
      select.replaceChildren(...plates.map((p,i)=>new Option((i+1)+' / '+plates.length+' 枚目（'+(p.clear?'透明PETG・':'')+p.placements.length+'部品）',i)));
      select.selectedIndex=Math.min(index,plates.length-1);
      totalLabel.textContent='全'+plates.length+'枚の合計';totalAmount.textContent=filamentLabel(estimate.total);
      const hasClear=plates.some(p=>p.clear);
      clearAmount.hidden=clearAmount.previousElementSibling.hidden=!hasClear;
      if(hasClear){
        const clear={grams:0,meters:0};
        plates.forEach((plate,i)=>{if(plate.clear){clear.grams+=estimate.plates[i].grams;clear.meters+=estimate.plates[i].meters;}});
        clearAmount.textContent=filamentLabel(clear);
      }
      thinRailNote.hidden=estimate.total!==null;
      layout.hidden=false;redraw();
      const ordered=[...bill.filter(p=>p.kind==='rail'),...bill.filter(p=>p.kind!=='rail')];
      return {rows:ordered.map(p=>({label:framePartName(p)+' × '+p.count})),data:{plates,plans},
        action:plates.length===1?'3MFを保存':'全'+plates.length+'枚をZIPで保存',
        detail:'180 × 180 mm ／ A1 mini・PETG。'+(plates.length===1?'部品を並べた3MFを保存します。':'プレートごとの3MFを1つのZIPにまとめます。')+
          (plans.length?' 透明板用のプレート名には「-clear」が付きます。取付位置は同梱の panel-assembly.txt に記載します。':'')};
    },
    async run({plates,plans}){
      try{
        const saved=await saveFramePlates(plates,{plans,download,isCurrent,nozzle:printSettings.nozzle,name:name+'-T溝フレーム',progress:(n,total)=>notify('印刷プレートを作成中 '+n+' / '+total)});
        if(saved)notify(plates.length+'枚のフレーム部品プレートを出力しました。');
      }catch(error){notify('フレーム部品を出力できませんでした。'+error.message);}
    }
  };
}
export function frameOutputEntries(frames,options) {
  const {bodyName}=options,printSettings={nozzle:.4};
  return [...(frames.length>1?[frameOutputEntry(frames,'全てのT溝フレーム',options,printSettings)]:[]),
    ...frames.map(f=>frameOutputEntry([f],bodyName(f.spec.target)+' の外周フレーム',options,printSettings))];
}
export function manualFrameOutputEntry(options){
  return frameOutputEntry([],'部品単体・設定',options,{nozzle:.4});
}
