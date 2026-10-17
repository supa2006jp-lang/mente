export const barrierPartColors=['#159bb8','#b95cca','#62a641','#db8a2a','#5573d2','#d7587c'];
export function createBarrierSelectionControls({onChange}){
 let settings={},bodies=[],excluded=new Set(),results=[],enabled=true,active=false;
 const views=['','viewport-'].map(prefix=>{
  const root=document.createElement('div');root.id=prefix+'barrier-selection-options';root.hidden=true;
  const label=document.createElement('label');label.textContent='避けるボディ';
  const mode=document.createElement('select');mode.id=prefix+'barrier-bodies-mode';mode.add(new Option('全て（押し出し元・結合先を除く）','all'));mode.add(new Option('指定したボディだけ','selected'));label.append(mode);
  const list=document.createElement('div');list.id=prefix+'barrier-bodies';list.style.cssText='max-height:150px;overflow:auto;padding:4px';
  const sideLabel=document.createElement('label');sideLabel.textContent='中空円柱：残す範囲';
  const side=document.createElement('select');side.id=prefix+'barrier-side';for(const [value,text] of [['both','内側・外側の両方'],['inside','穴の内側だけ'],['outside','外側だけ']])side.add(new Option(text,value));sideLabel.append(side);
  const note=document.createElement('small');note.textContent='内側・外側は、避けるボディの全周つながった円筒の内壁で判定します。';note.style.cssText='display:block;line-height:1.5';
  const parts=document.createElement('fieldset');parts.id=prefix+'barrier-fragments';parts.style.cssText='margin:8px 0;padding:7px;border:1px solid #9ab6c5;border-radius:4px';
  const legend=document.createElement('legend');legend.textContent='分断された塊';
  const reset=document.createElement('button');reset.type='button';reset.id=prefix+'barrier-keep-all';reset.textContent='全て残す';
  const partList=document.createElement('div');partList.id=prefix+'barrier-fragment-list';partList.style.cssText='max-height:190px;overflow:auto';
  const partNote=document.createElement('small');partNote.textContent='色を確認して残す塊にチェック。外した塊は薄い灰色になります。形状が変わったら「全て残す」で再選択できます。';partNote.style.cssText='display:block;line-height:1.5';
  parts.append(legend,reset,partList,partNote);root.append(label,list,sideLabel,note,parts);
  document.getElementById(prefix+'barrier').closest('.extrusion-barrier-controls').append(root);
  mode.onchange=()=>{if(mode.value==='all')delete settings.barrierBodies;else settings.barrierBodies=bodies.filter(b=>!excluded.has(b.id)).map(b=>b.id);delete settings.barrierFragments;results=[];render();onChange();};
  side.onchange=()=>{settings.barrierSide=side.value;delete settings.barrierFragments;results=[];render();onChange();};
  reset.onclick=()=>{delete settings.barrierFragments;render();onChange();};
  return {prefix,root,mode,list,side,parts,reset,partList};
 });
 function render(){for(const view of views){
  view.root.hidden=!active;view.mode.value=settings.barrierBodies?'selected':'all';view.mode.disabled=!enabled;view.side.value=settings.barrierSide||'both';view.side.disabled=!enabled;
  view.list.hidden=!settings.barrierBodies;view.list.replaceChildren();
  for(const body of bodies){const label=document.createElement('label'),input=document.createElement('input');label.style.cssText='display:flex;gap:6px;align-items:center;margin:5px 0';input.type='checkbox';input.checked=settings.barrierBodies?.includes(body.id)&&!excluded.has(body.id);input.disabled=!enabled||excluded.has(body.id);input.dataset.bodyId=body.id;label.append(input,document.createTextNode(body.name+(excluded.has(body.id)?'（押し出し元・結合先）':'')));view.list.append(label);
   input.onchange=()=>{settings.barrierBodies=bodies.filter(b=>b.id===body.id?input.checked:settings.barrierBodies.includes(b.id)).map(b=>b.id);delete settings.barrierFragments;results=[];render();onChange();};
  }
  view.reset.disabled=!enabled;view.partList.replaceChildren();
  if(!results.length){const empty=document.createElement('small');empty.textContent='プレビュー更新後に塊を選べます。';view.partList.append(empty);}
  for(const [ri,result] of results.entries())for(const part of result.barrierFragments||[]){
   const scope=result.barrierFragmentScope,label=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('span');label.style.cssText='display:flex;align-items:center;gap:6px;margin:5px 0';input.type='checkbox';input.dataset.fragmentKey=part.key;input.dataset.fragmentScope=scope;
   input.checked=!settings.barrierFragments?.[scope]||settings.barrierFragments[scope].includes(part.key);input.disabled=!enabled;swatch.style.cssText='display:inline-block;width:13px;height:13px;border-radius:3px;background:'+barrierPartColors[part.index%barrierPartColors.length];
   label.append(input,swatch,document.createTextNode((results.length>1?'領域'+(ri+1)+' / ':'')+'塊'+(part.index+1)+' · '+Number(part.volume.toFixed(2))+' mm³'));view.partList.append(label);
   input.onchange=()=>{const keys=result.barrierFragments.filter(p=>p.key===part.key?input.checked:!settings.barrierFragments?.[scope]||settings.barrierFragments[scope].includes(p.key)).map(p=>p.key);if(!keys.length){input.checked=true;return;}settings.barrierFragments={...settings.barrierFragments,[scope]:keys};render();onChange();};
  }
 }}
 return {
  settings(){return structuredClone(settings);},
  load(feature={}){settings={};for(const key of ['barrierBodies','barrierSide','barrierFragments'])if(feature[key]!==undefined)settings[key]=structuredClone(feature[key]);results=[];render();},
  sync(options){({bodies,enabled,active}=options);excluded=new Set(options.excluded);render();},
  showResults(previews){results=previews;render();}
 };
}
