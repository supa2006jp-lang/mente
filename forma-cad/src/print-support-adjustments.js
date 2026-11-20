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
const permissionLabels={roofLayers:'上面の薄皮の層数',bottomSkinLayers:'底面の薄皮の層数',wallRoof:'上面の薄皮を外す',wallBottomSkin:'底面の薄皮を外す'};
export const supportAdjustmentLabel=key=>permissionLabels[key]??labels[key][0];
const faceFields=['wallPitch','roofLayers','bottomSkinLayers','wallRoof','wallBottomSkin'];
const minimumPitch=p=>Math.max(2,Math.floor(p.wallThickness*10+1)/10);
const rounded=value=>Math.round(value*100)/100;
export const sameSupportFace=(a,b)=>a&&b&&a.bodyId===b.bodyId&&a.point.every((value,i)=>Math.abs(value-b.point[i])<1e-5);
const faceOverride=(p,selection)=>p.faceOverrides?.find(row=>sameSupportFace(row.selection,selection));

function changeFaceSetting(p,hint,key,value){
 const {selection}=hint,existing=faceOverride(p,selection);
 if(!selection||(hint.onlyCeiling||p.mode==='face'&&p.faces?.length===1)&&!existing)
  return p[key]===value?p:{...p,[key]:value};
 if((existing?.[key]??p[key])===value)return p;
 const overrides=p.faceOverrides??[];
 if(!existing&&overrides.length>=32)return p;
 const updated=existing?overrides.map(row=>row===existing?{...row,[key]:value}:row):[...overrides,{selection,[key]:value}];
 return {...p,faceOverrides:updated};
}

function adjustmentHints(state){
 return state.error?.supportAdjustmentHints??state.result?.supportPreview?.adjustmentHints??[];
}

function candidates(state,original,allowed){
 const p=state.input,a=state.result?.analysis?.printSupport,initial=original.result?.analysis?.printSupport;
 const hints=adjustmentHints(state);
 const pinned=!!(p.excludedRibs?.length||p.roofTabPlacements?.length||p.faceOverrides?.some(row=>row.localRibs?.length||row.ribWidths?.length));
 const next=[];
 const set=(key,value)=>{if(allowed.has(key)&&p[key]!==value)next.push({...p,[key]:value});};
 function alternateDirection(){
  if(pinned)return;
  for(const value of p.wallDirection==='x'?['y']:p.wallDirection==='y'?['x']:['x','y'])set('wallDirection',value);
 }
 function withoutSkin(settings,hint){
  const upper=hint.role==='upper',flag=upper?'wallRoof':'wallBottomSkin',count=upper?'roof':'bottomSkin';
  if(!allowed.has(flag)||upper&&p.roofTabPlacements?.length)return settings;
  if(!hint.selection&&(initial?.[count]?.count||a?.[count]?.count||p.mode==='face'&&p.faces?.length>1))return settings;
  return changeFaceSetting(settings,hint,flag,false);
 }
 let adjusted=p;
 for(const hint of hints.filter(hint=>hint.kind==='skin-clearance')){
  const key=hint.role==='upper'?'roofLayers':'bottomSkinLayers';
  const current=faceOverride(adjusted,hint.selection)?.[key]??adjusted[key];
  const available=Number.isFinite(hint.available)?Math.floor((hint.available+1e-6)/p.layerHeight):current-1;
  if(current>1&&available>=1&&allowed.has(key))adjusted=changeFaceSetting(adjusted,hint,key,Math.min(current-1,available));
  else if(available<1||current===1)adjusted=withoutSkin(adjusted,hint);
 }
 if(adjusted!==p)next.push(adjusted);
 for(const hint of hints){
  switch(hint.kind){
   case 'base-blocked':
    if(!pinned&&p.baseMode==='bed')set('baseMode','bedOrModel');
    break;
   case 'skin-anchor': {
    if(hint.role==='upper'){
     if(!pinned&&allowed.has('wallPitch')){
      const pitch=faceOverride(p,hint.selection)?.wallPitch??p.wallPitch;
      const closer=Math.max(minimumPitch(p),rounded(pitch*.6));
      if(closer<pitch)next.push(changeFaceSetting(p,hint,'wallPitch',closer));
     }
     alternateDirection();
    }else if(!pinned&&p.baseMode==='bed')set('baseMode','bedOrModel');
    const reduced=withoutSkin(p,hint);
    if(reduced!==p)next.push(reduced);
    break;
   }
   case 'rib-limit':
    if(!pinned){
     if(allowed.has('wallPitch')){
      const factor=Math.max(1.15,(hint.total||0)/96);
      for(const multiplier of [factor,Math.max(1.6,factor*1.25)]){
       const wider=pitch=>Math.min(15,rounded(Math.max(pitch+.5,pitch*multiplier)));
       const faceOverrides=p.faceOverrides?.map(row=>row.wallPitch?{...row,wallPitch:wider(row.wallPitch)}:row);
       next.push({...p,wallPitch:wider(p.wallPitch),...(faceOverrides?{faceOverrides}:{})});
      }
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
function placedFaces(result){
 const preview=result?.supportPreview;
 return new Set([...(preview?.ribs??[]).filter(rib=>!rib.excluded),...(preview?.columns??[])].map(part=>part.ceilingId));
}

function improves(result,original,changes){
 if(!usable(result))return false;
 const covered=placedFaces(result);
 const coverage=result.supportPreview.coverage??[];
 if(changes.some(({key,right,selection})=>selection&&!right&&(key==='wallRoof'||key==='wallBottomSkin')&&
  !coverage.some(row=>sameSupportFace(row.selection,selection)&&covered.has(row.ceilingId))))return false;
 const before=original?.analysis?.printSupport,after=result.analysis.printSupport;
 if(!before)return true;
 if(after.faceCount<before.faceCount||omitted(result)>omitted(original)||
    (after.roof?.count??0)<(before.roof?.count??0)||(after.bottomSkin?.count??0)<(before.bottomSkin?.count??0))return false;
 if([...placedFaces(original)].some(id=>id&&!covered.has(id)))return false;
 const rows=new Map(coverage.filter(row=>row.ceilingId).map(row=>[row.ceilingId,row]));
 for(const row of original.supportPreview?.coverage??[]){
  if(!row.ceilingId)continue;
  const next=rows.get(row.ceilingId);
  if(['upper','lower'].some(role=>row.skin?.[role]?.present&&!next?.skin?.[role]?.present))return false;
 }
 return !usable(original)||omitted(result)<omitted(original)||after.faceCount>before.faceCount;
}

function projectedArea(mesh){
 if(!mesh)return 0;
 const {vertices:v,triangles:t}=mesh;
 let area=0;
 for(let i=0;i<t.length;i+=3){
  const a=t[i]*3,b=t[i+1]*3,c=t[i+2]*3;
  area+=Math.abs((v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]));
 }
 return area*.5;
}

function supportQuality(result){
 const analysis=result?.analysis?.printSupport;
 if(!analysis)return null;
 const coverage=result.supportPreview?.coverage??[];
 const spans=coverage.filter(row=>row.ceilingId&&row.bridges).map(row=>Math.max(row.bridges.max,row.bridges.unbraced)).filter(Number.isFinite);
 return {faces:analysis.faceCount??0,omitted:omitted(result),roofArea:coverage.reduce((sum,row)=>sum+projectedArea(row.skinSupport?.face),0),
  gap:spans.length?Math.max(...spans):null};
}

function compareQuality(a,b){
 const width=a.gap===null||b.gap===null?0:rounded(b.gap)-rounded(a.gap);
 return a.faces-b.faces||b.omitted-a.omitted||rounded(a.roofArea)-rounded(b.roofArea)||width;
}

function settingChanges(before,after){
 const changes=[];
 function add(key,left,right,selection){
  if(left!==right)changes.push({key,left,right,selection});
 }
 for(const key of supportAdjustmentFields)add(key,before[key],after[key]);
 for(const row of after.faceOverrides??[]){
  const old=faceOverride(before,row.selection);
  for(const key of faceFields)if(row[key]!==undefined)add(key,old?.[key]??before[key],row[key],row.selection);
 }
 return changes;
}

const names={bed:'ベッドのみ',bedOrModel:'ベッドとモデルの上面',x:'横方向（X）',y:'縦方向（Y）',auto:'自動'};
function valueText(value,unit){
 if(typeof value==='boolean')return value?'オン':'オフ';
 return typeof value==='number'?rounded(value)+unit:names[value]??String(value);
}
export function describeSupportAdjustment(before,after){
 return settingChanges(before,after).map(({key,left,right,selection})=>{
  const [label,unit='']=labels[key];
  const prefix=selection?'高さ '+rounded(selection.point[2])+' mmの下面 ／ ':'';
  return prefix+label+' '+valueText(left,unit)+' → '+valueText(right,unit);
 });
}

function hintMessage(hint){
 const skin=hint.role==='upper'?'上面の薄皮':'底面の薄皮';
 if(hint.kind==='skin-clearance')return skin+'が収まらない'+(Number.isFinite(hint.available)?'（空き '+rounded(hint.available)+' mm）':'');
 if(hint.kind==='skin-anchor')return hint.role==='upper'?'薄皮を両側から支えるリブが足りない':'底面の薄皮を置ける水平な土台がない';
 return ({'base-blocked':'ベッドからのリブが遮られた','rib-limit':'リブの数が上限を超えた','tie-limit':'横つなぎの数が上限を超えた',
  'roof-seams':'上面の分割数が上限を超えた','bottom-seams':'底面の分割数が上限を超えた','no-width':'横すき間とリブの厚みを確保できない',
  'exterior-only':'外側の小片を省略','window-split':'窓抜きでリブが分断された','contact-split':'接触層でリブが分断された'})[hint.kind]??'配置を要確認';
}

function trialSummary(state,original,number){
 const result=state.result,hints=adjustmentHints(state);
 const covered=placedFaces(result),faces=[];
 const coverage=result?.supportPreview?.coverage??state.error?.supportCoverage??[];
 for(const row of coverage){
  if(!row.ceilingId||!row.selection)continue;
  const placed=covered.has(row.ceilingId);
  const notes=hints.filter(hint=>hint.ceilingId===row.ceilingId||sameSupportFace(hint.selection,row.selection)).map(hintMessage);
  const status=placed?(notes.length?'一部配置':'配置'):'配置できず';
  if(row.suppressed)notes.push(row.suppressedReason==='bore'?'小さな丸穴を省略':'外側の小片を省略');
  if(result?.supportPreview?.columns?.some(column=>column.ceilingId===row.ceilingId))notes.push('柱型で補完');
  if(placed)for(const [field,role,label] of [['wallRoof','upper','上面'],['wallBottomSkin','lower','底面']])
   if(row.override?.[field]===false&&row.skin?.[role]?.enabled===false)notes.push(label+'の薄皮なし');
  faces.push({selection:row.selection,number:row.ceilingNumber,placed,status,notes});
 }
 for(const hint of hints){
  if(!hint.selection||faces.some(face=>sameSupportFace(face.selection,hint.selection)))continue;
  faces.push({selection:hint.selection,number:hint.number,placed:false,status:'配置できず',notes:[hintMessage(hint)]});
 }
 const hasParts=!!result?.outputs?.length,ready=usable(result);
 const notices=state.error?[state.error.message]:[...(result?.analysis?.printSupport?.ribs?.issues??[]),
  ...(result?.supportPreview?.exportStatus?.issues??[]).map(issue=>issue.message)];
 return {number,changes:number?describeSupportAdjustment(original,state.input):[],status:ready?'ready':hasParts?'preflight':'failed',
  faces,notices:[...new Set(notices.filter(Boolean))],quality:hasParts?supportQuality(result):null,
  mass:result?.analysis?.printSupport?.material?.massG??null,...(ready?{settings:structuredClone(state.input)}:{})};
}

export async function adjustSupportPreview(input,{
 run,initial=run,enabled=true,allowedFields=supportAdjustmentFields,current=()=>true,onTrial,onReport,
}){
 async function evaluate(settings,compute){
  try{return {input:settings,result:await compute(settings)};}
  catch(error){return {input:settings,error};}
 }
 const original=await evaluate(input,initial);
 const finish=state=>{if(state.error)throw state.error;return state;};
 if(!enabled||input.style!=='walls'||!current())return finish(original);
 const key=p=>JSON.stringify([supportAdjustmentFields.map(name=>p[name]),p.faceOverrides??[]]);
 const allowed=new Set(allowedFields),before=structuredClone(input),seen=new Set([key(input)]),queue=candidates(original,original,allowed);
 const originalHints=adjustmentHints(original);
 const logs=onReport?[trialSummary(original,before,0)]:[];
 let best=null,attempts=0;
 while(queue.length&&attempts<4&&current()){
  const settings=queue.shift(),signature=key(settings);
  if(seen.has(signature))continue;
  seen.add(signature);
  const changes=settingChanges(before,settings);
  if(!changes.length||changes.some(change=>!allowed.has(change.key)))continue;
  attempts++;
  onTrial?.(attempts);
  const trial=await evaluate(settings,run);
  if(!current())return finish(original);
  if(onReport)logs.push(trialSummary(trial,before,attempts));
  if(improves(trial.result,original.result,changes)){
   const quality=supportQuality(trial.result),comparison=best?compareQuality(quality,best.quality):1;
   if(comparison>0||comparison===0&&changes.length<best.changes)
    best={...trial,quality,number:attempts,changes:changes.length};
  }
  if(['cancelled','timeout','engine'].includes(trial.error?.code))break;
  if(!best||omitted(trial.result)>0){
   const options=candidates(trial,original,allowed);
   if(best?.number===attempts||trial.error?.supportAdjustmentHints?.some(hint=>hint.kind==='skin-clearance'||hint.kind==='base-blocked'))queue.unshift(...options);
   else queue.push(...options);
  }
 }
 if(onReport&&(attempts||original.error||originalHints.length||!usable(original.result)))
  onReport({trials:logs,selected:best?.number??(usable(original.result)?0:null)});
 if(!best)return {...finish(original),attempts};
 return {input:best.input,result:best.result,adjustment:{before,changes:describeSupportAdjustment(before,best.input)},attempts};
}
