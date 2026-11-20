export function supportAdjustmentError(message,hint){
 return Object.assign(Error(message),{supportAdjustmentHints:[hint]});
}

const labels={
 baseMode:['支え始める場所'],wallPitch:['薄壁の間隔',' mm'],wallDirection:['リブの向き'],
 roofLayers:['上面の薄皮','層'],bottomSkinLayers:['底面の薄皮','層'],wallRoof:['上面の薄皮'],wallBottomSkin:['底面の薄皮'],
 tieInterval:['横つなぎの高さ間隔',' mm'],roofSectionLength:['上面の分割間隔',' mm'],bottomSectionLength:['底面の分割間隔',' mm'],
 wallWindows:['窓抜き'],skipSmallExterior:['外側の小さなリブを省く'],
};
export const supportAdjustmentFields=Object.keys(labels);
const minimumPitch=p=>Math.max(2,Math.floor(p.wallThickness*10+1)/10);
const rounded=value=>Math.round(value*100)/100;
const sameFace=(a,b)=>a&&b&&a.bodyId===b.bodyId&&a.point.every((value,i)=>Math.abs(value-b.point[i])<1e-5);
const faceOverride=(p,selection)=>p.faceOverrides?.find(row=>sameFace(row.selection,selection));

function changeFaceSetting(p,hint,key,value){
 const {selection}=hint,existing=faceOverride(p,selection);
 if(!selection||(hint.onlyCeiling||p.mode==='face'&&p.faces?.length===1)&&!existing)return {...p,[key]:value};
 const overrides=p.faceOverrides??[];
 if(!existing&&overrides.length>=32)return {...p,[key]:value};
 const updated=existing?overrides.map(row=>row===existing?{...row,[key]:value}:row):[...overrides,{selection,[key]:value}];
 return {...p,faceOverrides:updated};
}

function candidates(state,original){
 const p=state.input,a=state.result?.analysis?.printSupport,initial=original.result?.analysis?.printSupport;
 const hints=state.error?.supportAdjustmentHints??state.result?.supportPreview?.adjustmentHints??[];
 const pinned=!!(p.excludedRibs?.length||p.roofTabPlacements?.length||p.faceOverrides?.some(row=>row.localRibs?.length));
 const next=[];
 const set=(key,value)=>{if(p[key]!==value)next.push({...p,[key]:value});};
 function alternateDirection(){
  if(pinned)return;
  for(const value of p.wallDirection==='x'?['y']:p.wallDirection==='y'?['x']:['x','y'])set('wallDirection',value);
 }
 function withoutSkin(role){
  const upper=role==='upper',flag=upper?'wallRoof':'wallBottomSkin',count=upper?'roof':'bottomSkin';
  if(initial?.[count]?.count||a?.[count]?.count||p.mode==='face'&&p.faces?.length>1||upper&&p.roofTabPlacements?.length)return;
  set(flag,false);
 }
 const clearance=hints.filter(hint=>hint.kind==='skin-clearance');
 let thinner=p;
 for(const hint of clearance){
  const key=hint.role==='upper'?'roofLayers':'bottomSkinLayers';
  const current=faceOverride(thinner,hint.selection)?.[key]??thinner[key];
  const free=Number.isFinite(hint.available)?Math.floor((hint.available+1e-6)/p.layerHeight):current-1;
  if(current>1&&free>=1)thinner=changeFaceSetting(thinner,hint,key,Math.min(current-1,free));
 }
 if(thinner!==p)next.push(thinner);
 for(const hint of hints){
  switch(hint.kind){
   case 'base-blocked':
    if(!pinned&&p.baseMode==='bed')set('baseMode','bedOrModel');
    break;
   case 'skin-clearance':
    if(thinner===p)withoutSkin(hint.role);
    break;
   case 'skin-anchor':
    if(hint.role==='upper'){
     if(!pinned){
      const pitch=faceOverride(p,hint.selection)?.wallPitch??p.wallPitch;
      const closer=Math.max(minimumPitch(p),rounded(pitch*.6));
      if(closer<pitch)next.push(changeFaceSetting(p,hint,'wallPitch',closer));
      alternateDirection();
     }
    }else if(!pinned&&p.baseMode==='bed')set('baseMode','bedOrModel');
    withoutSkin(hint.role);
    break;
   case 'rib-limit':
    if(!pinned){
     const factor=Math.max(1.15,(hint.total||0)/96);
     for(const multiplier of [factor,Math.max(1.6,factor*1.25)]){
      const wider=pitch=>Math.min(15,rounded(Math.max(pitch+.5,pitch*multiplier)));
      const faceOverrides=p.faceOverrides?.map(row=>row.wallPitch?{...row,wallPitch:wider(row.wallPitch)}:row);
      next.push({...p,wallPitch:wider(p.wallPitch),...(faceOverrides?{faceOverrides}:{})});
     }
     alternateDirection();
    }
    break;
   case 'tie-limit':
    set('tieInterval',Math.min(60,Math.ceil(p.tieInterval*1.5)));
    set('tieInterval',60);
    break;
   case 'roof-seams':
   case 'bottom-seams': {
    const key=hint.kind==='roof-seams'?'roofSectionLength':'bottomSectionLength';
    set(key,Math.min(60,Math.ceil(p[key]*1.5)));
    set(key,60);
    break;
   }
   case 'no-width':
    alternateDirection();
    break;
   case 'exterior-only':
    if(!pinned&&p.skipSmallExterior)set('skipSmallExterior',false);
    break;
   case 'window-split':
    set('wallWindows',false);
    break;
   case 'contact-split':
    for(const role of hint.roles||[]){
     const key=role==='upper'?'roofLayers':'bottomSkinLayers';
     if(p[key]===1)set(key,2);
    }
    break;
  }
 }
 const parts=state.result?.supportPreview?.exportStatus?.parts??[];
 if(parts.some(part=>!part.ok)&&parts.every(part=>part.ok||part.role==='support'||part.role==='blocker')){
  if(p.wallWindows)set('wallWindows',false);
  alternateDirection();
 }
 return next;
}

function usable(result){
 return !!(result?.outputs?.length&&result.supportPreview?.exportStatus?.ok&&!result.analysis.printSupport.ribs?.issues?.length);
}

const omitted=result=>result?.analysis?.printSupport?.skippedCeilings?.length??0;

function improves(result,original){
 if(!usable(result))return false;
 const before=original?.analysis?.printSupport,after=result.analysis.printSupport;
 if(!before)return true;
 if(after.faceCount<before.faceCount||omitted(result)>omitted(original)||
    (after.roof?.count??0)<(before.roof?.count??0)||(after.bottomSkin?.count??0)<(before.bottomSkin?.count??0))return false;
 const covered=new Set(result.supportPreview.ribs?.filter(rib=>!rib.excluded).map(rib=>rib.ceilingId));
 if(original.supportPreview?.ribs?.some(rib=>!rib.excluded&&rib.ceilingId&&!covered.has(rib.ceilingId)))return false;
 return !usable(original)||omitted(result)<omitted(original)||after.faceCount>before.faceCount;
}

export async function adjustSupportPreview(input,{run,initial=run,enabled=true,current=()=>true,onTrial}){
 async function evaluate(settings,compute){
  try{return {input:settings,result:await compute(settings)};}
  catch(error){return {input:settings,error};}
 }
 const original=await evaluate(input,initial);
 const finish=state=>{if(state.error)throw state.error;return state;};
 if(!enabled||input.style!=='walls'||!current())return finish(original);
 const key=p=>JSON.stringify([supportAdjustmentFields.map(name=>p[name]),p.faceOverrides??[]]);
 const before=structuredClone(input),seen=new Set([key(input)]),queue=candidates(original,original);
 let best,attempts=0;
 while(queue.length&&attempts<4&&current()){
  const settings=queue.shift(),signature=key(settings);
  if(seen.has(signature))continue;
  seen.add(signature);
  onTrial?.(++attempts);
  const trial=await evaluate(settings,run);
  if(!current())return finish(original);
  if(improves(trial.result,original.result)){
   if(!best||omitted(trial.result)<omitted(best.result))best=trial;
   if(omitted(trial.result)===0)break;
  }
  if(trial.error?.code==='cancelled'||trial.error?.code==='timeout'||trial.error?.code==='engine')break;
  const options=candidates(trial,original);
  if(best===trial||trial.error?.supportAdjustmentHints?.some(hint=>hint.kind==='skin-clearance'||hint.kind==='base-blocked'))queue.unshift(...options);
  else queue.push(...options);
 }
 return best?{...best,adjustment:{before,changes:describeSupportAdjustment(before,best.input)},attempts}:
  {...finish(original),attempts};
}

const names={bed:'ベッドのみ',bedOrModel:'ベッドとモデルの上面',x:'横方向（X）',y:'縦方向（Y）',auto:'自動'};
function valueText(value,unit){
 if(typeof value==='boolean')return value?'オン':'オフ';
 return typeof value==='number'?rounded(value)+unit:names[value]??String(value);
}
export function describeSupportAdjustment(before,after){
 const lines=[];
 function add(key,left,right,prefix=''){
  if(left===right)return;
  const [label,unit='']=labels[key];
  lines.push(prefix+label+' '+valueText(left,unit)+' → '+valueText(right,unit));
 }
 for(const key of supportAdjustmentFields)add(key,before[key],after[key]);
 for(const row of after.faceOverrides??[]){
  const old=faceOverride(before,row.selection);
  const prefix='高さ '+rounded(row.selection.point[2])+' mmの下面 ／ ';
  for(const key of ['wallPitch','roofLayers','bottomSkinLayers'])if(row[key]!==undefined)
   add(key,old?.[key]??before[key],row[key],prefix);
 }
 return lines;
}
