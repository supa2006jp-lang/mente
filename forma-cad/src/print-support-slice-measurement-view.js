const colors={clear:0x08796f,short:0xca5b13,overlap:0xd92d53,rib:0x087f58,auto:0x286bc2,model:0x7459b1,open:0xe1751a};
const mm=value=>Number(value.toFixed(2))+' mm';
const unsignedGap=value=>value>=0?mm(value):'押出範囲が '+mm(-value)+' 重なる';

function details(title,key){
 const panel=document.createElement('details'),summary=document.createElement('summary');
 panel.dataset.sliceMeasure=key;
 summary.textContent=title;panel.append(summary);
 return panel;
}

function note(parent,label){
 const text=document.createElement('small');
 text.textContent=label;
 parent.append(text);
 return text;
}

function button(parent,text,key,click){
 const control=document.createElement('button');
 control.type='button';control.textContent=text;control.dataset.sliceMeasureAction=key;
 control.style.cssText='display:block;width:100%;text-align:left;margin:5px 0';
 control.setAttribute('aria-pressed','false');
 control.onclick=click;
 parent.append(control);
 return control;
}

function selectField(parent,label,options){
 const field=document.createElement('label'),select=document.createElement('select');
 select.setAttribute('aria-label',label);
 for(const [i,text] of options.entries())select.add(new Option(text,String(i)));
 field.append(label,select);parent.append(field);
 return select;
}

function legend(parent,keys){
 const descriptions={clear:'指定のすき間以上',short:'指定より狭い',overlap:'押出範囲が重なる',rib:'リブ・薄皮・柱',
  auto:'自動サポート',model:'本体・土台',open:'直下の支えなし'};
 const row=document.createElement('small');
 row.style.cssText='display:flex;gap:4px 10px;flex-wrap:wrap';
 for(const key of keys){
  const item=document.createElement('span'),color=document.createElement('span');
  color.style.cssText='display:inline-block;width:.7em;height:.7em;margin-right:3px;background:#'+colors[key].toString(16).padStart(6,'0');
  item.append(color,descriptions[key]);row.append(item);
 }
 parent.append(row);
}

function lateralPanel(targets,bodyName,showOverlay,clearOverlay){
 const panel=details('スライス後の横すき間','lateral');
 const selected=targets.length>1?selectField(panel,'確認するボディ',targets.map(row=>bodyName(row.target))):null;
 const label=document.createElement('label'),slider=document.createElement('input');
 slider.type='range';slider.min='0';slider.step='1';slider.dataset.sliceMeasureLayer='';
 slider.setAttribute('aria-label','横すき間を確認する層');
 label.append('測定した層',slider);panel.append(label);
 const summary=note(panel,''),reading=note(panel,''),basis=note(panel,'');
 const current=()=>targets[Number(selected?.value??0)];
 const layer=()=>current().layers[Number(slider.value)];
 const show=button(panel,'選んだ層の位置を表示','lateral-show',()=>draw(true));
 legend(panel,['overlap','short','clear']);
 function draw(fit){
  const row=layer(),target=current();
  if(!row||show.disabled)return;
  const groups=new Map();
  for(const sample of row.samples){
   const color=colors[sample.gap<-.005?'overlap':sample.gap<target.requested-.01?'short':'clear'];
   if(!groups.has(color))groups.set(color,{color,lines:[],points:[]});
   const group=groups.get(color);
   group.lines.push(...sample.from,...sample.to);
   group.points.push(...sample.from.map((value,i)=>(value+sample.to[i])/2));
  }
  showOverlay(show,[...groups.values()],{kind:'lateral',layer:row.index,minimum:row.minimum,target:target.target,fit});
 }
 function describe(){
  const row=layer();
  reading.textContent=row?'第 '+row.index+' 層 ／ 高さ '+mm(row.z)+' ／ 最小の目安 '+unsignedGap(row.minimum):
   '同じ層にある近接した側壁とリブの経路を確認できませんでした。';
  basis.textContent=row?'押出線の幅を含めた目安です。'+
   (row.samples.some(sample=>!sample.widthKnown)?'線幅の記録がない経路にはCAD側の線幅を使いました。':''):'';
 }
 function setTarget(){
  const target=current(),measured=target.layers;
  const worst=measured.reduce((index,row,i)=>row.minimum<measured[index].minimum?i:index,0);
  slider.max=String(Math.max(0,measured.length-1));slider.value=String(worst);
  slider.dataset.empty=String(!measured.length);
  show.dataset.empty=String(!measured.length);
  slider.disabled=show.disabled=!measured.length;
  summary.textContent='CADの指定 '+mm(target.requested)+' ／ 測定 '+measured.length+'層'+
   (measured.length?' ／ 指定より狭い '+measured.filter(row=>row.minimum<target.requested-.01).length+'層':'');
  describe();
 }
 slider.oninput=()=>{describe();if(show.getAttribute('aria-pressed')==='true')draw(false);};
 if(selected)selected.onchange=()=>{
  const visible=show.getAttribute('aria-pressed')==='true';
  setTarget();
  if(visible){if(layer())draw(true);else clearOverlay();}
 };
 setTarget();
 return panel;
}

function ceilingPanel(ceilings,bodyName,showOverlay,clearOverlay){
 const panel=details('天井を刷り始める層の支え','ceiling');
 const showBody=new Set(ceilings.map(row=>row.target)).size>1;
 const selected=selectField(panel,'確認する下面',ceilings.map(row=>(showBody?bodyName(row.target)+' ／ ':'')+
  '下面 '+row.number+'（高さ '+mm(row.height)+'）'));
 const reading=note(panel,''),gap=note(panel,'');
 const show=button(panel,'天井の印刷経路を表示','ceiling-show',draw);
 legend(panel,['rib','auto','model','open']);
 note(panel,'天井の経路に直下の造形を重ねた目安です。');
 const current=()=>ceilings[Number(selected.value)];
 function draw(){
  const row=current(),measured=row.measured;
  if(!measured||show.disabled)return;
  const groups=Object.entries(measured.paths).filter(([,lines])=>lines.length).map(([role,lines])=>({color:colors[role],lines}));
  showOverlay(show,groups,{kind:'ceiling',layer:measured.index,target:row.target,id:row.id,unsupported:measured.lengths.open});
 }
 function describe(){
  const row=current(),measured=row.measured;
  reading.textContent=measured?'第 '+measured.index+' 層 ／ 高さ '+mm(measured.z)+' ／ 経路の長さ '+mm(measured.total):
   'この下面を刷り始める経路を確認できませんでした。';
  gap.textContent=measured?'直下の支えがない経路 合計 '+mm(measured.lengths.open)+' ／ 最長連続区間 '+mm(measured.longest)+
   (measured.limited?'（経路が多いため重ね表示を一部省略）':''):'';
  show.disabled=!measured;
  show.dataset.empty=String(!measured);
 }
 selected.value=String(Math.max(0,ceilings.findIndex(row=>row.measured)));
 selected.onchange=()=>{
  const visible=show.getAttribute('aria-pressed')==='true';
  describe();
  if(visible){if(current().measured)draw();else clearOverlay();}
 };
 describe();
 return panel;
}

function comparisonPanel(comparison,reference,bodyName,showOverlay){
 const panel=details('前回のスライス結果と比較','comparison');
 const file=note(panel,'前回のファイル　'+reference.name);
 file.style.overflowWrap='anywhere';
 panel.open=true;
 for(const row of comparison){
  if(comparison.length>1)note(panel,bodyName(row.target));
  for(const [key,label,color] of [['restored','経路が復活',0x087f58],['remaining','まだ経路が欠けている',0xd92d53],
   ['moved','サポートの配置が変わった',0x7459b1]]){
   const {count,points}=row[key];
   const item=button(panel,label+' '+count+'点','comparison-'+key,()=>showOverlay(item,
    [{points:points.flat(),color}],{kind:'comparison-'+key,target:row.target,count}));
   item.disabled=!count;item.dataset.empty=String(!count);
  }
  const {compared,count,changes}=row.vertical;
  const vertical=button(panel,'縦すき間が変わった '+count+'点','comparison-vertical',()=>{
   const increases=changes.filter(item=>item.after.gap>item.before.gap);
   const decreases=changes.filter(item=>item.after.gap<=item.before.gap);
   showOverlay(vertical,[{points:increases.flatMap(item=>item.point),color:0x286bc2},
    {points:decreases.flatMap(item=>item.point),color:0xca5b13}],{kind:'comparison-vertical',target:row.target,count});
  });
  vertical.disabled=!count;vertical.dataset.empty=String(!count);
  note(panel,'前回と照合した縦すき間 '+compared+'点');
  if(changes.length){
   const changeList=details('縦すき間の変化量','gap-changes');
   const seen=new Set();
   for(const item of changes){
    const role=item.role==='upper'?'上側':'土台側';
    const message=role+' ／ '+item.before.layers+'層（'+mm(item.before.gap)+'） → '+item.after.layers+'層（'+mm(item.after.gap)+'）';
    if(seen.has(message))continue;
    seen.add(message);note(changeList,message);
    if(seen.size>=12)break;
   }
   panel.append(changeList);
  }
 }
 return panel;
}

export function renderSupportSliceMeasurements({lateral,ceilings,comparison},reference,{bodyName,showOverlay,clearOverlay}){
 const panels=document.createDocumentFragment();
 if(lateral?.length)panels.append(lateralPanel(lateral,bodyName,showOverlay,clearOverlay));
 if(ceilings?.length)panels.append(ceilingPanel(ceilings,bodyName,showOverlay,clearOverlay));
 if(comparison?.length&&reference)panels.append(comparisonPanel(comparison,reference,bodyName,showOverlay));
 return panels;
}
