import * as R from 'replicad';
import {makePrintSupport,validatePrintSupport} from './print-support.js';
import {contactGapVariants,contactRoleSettings} from './print-support-contact-settings.js';
import {fuseSolids} from './solid-fuse.js';
import {printSupportExportMesh} from './print-support-export-mesh.js';
import {inspectPrintSupportPackage} from './print-support-preflight.js';
export function makeSupportContactTrials(settings,onProgress){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('試験片の設定が不正です');
 const p=validatePrintSupport({...settings,type:'printSupport',id:'trial-support',target:'trial-model',mode:'auto',faces:[],style:'walls',contactLines:true,wallRoof:true,wallBottomSkin:true,baseMode:'bedOrModel',edgeRibs:true,excludedRibs:[],roofTabs:false,roofTabPlacements:[],wallWindows:false,roofSeams:false,bottomSeams:false,wallPitch:8,bedZ:0,preview:false});
 const upper=contactRoleSettings(p,'upper'),lower=contactRoleSettings(p,'lower');if(!upper.enabled&&!lower.enabled)throw Error('上面か底面の接触層をオンにしてください');const ug=contactGapVariants(upper.spacing),lg=contactGapVariants(lower.spacing),pkg={complete:true,layerHeight:p.layerHeight,bodies:[],blockers:[]},variants=[],base=Math.ceil(1.8/p.layerHeight)*p.layerHeight,gap=Math.ceil(Math.max(8,p.topGap+(p.roofLayers+p.bottomSkinLayers+4)*p.layerHeight+2)/p.layerHeight)*p.layerHeight,roof=base+gap,top=roof+Math.ceil(1.5/p.layerHeight)*p.layerHeight;
 for(let i=0;i<3;i++){
  const label=String.fromCharCode(65+i),x=i*38,parts=[R.makeBox([x,-6,0],[x+28,22,base]),R.makeBox([x,18,base],[x+28,22,top]),R.makeBox([x,0,roof],[x+28,22,top])],notches=[];let model,made;
  try{
   onProgress?.({stage:'比較試験片 '+label+'（'+(i+1)+'/3）を作成しています'});model=fuseSolids(parts,{onProgress,verifyMesh:true});for(let n=0;n<=i;n++)notches.push(R.makeBox([x+3+n*2,-5.4,base-.6],[x+3.8+n*2,-2.2,base+.01]));const tool=R.makeCompound(notches);try{const next=model.cut(tool);model.delete();model=next;}finally{tool.delete();}
   made=makePrintSupport(new Map([['trial-model',model]]),{...p,interfaceSpacing:ug[i],bottomInterfaceSpacing:lg[i]},onProgress);if(!made.shape||!made.analysis.complete)throw Error('試験片のサポートを作れませんでした');
   const name=label+'・溝'+(i+1)+'本（上 '+(upper.enabled?ug[i]:'オフ')+' / 下 '+(lower.enabled?lg[i]:'オフ')+' mm）';pkg.bodies.push({id:name+' 本体',...printSupportExportMesh(model)},{id:name+' サポート',...printSupportExportMesh(made.shape)});pkg.blockers.push(...made.blockers.map(s=>printSupportExportMesh(s)));variants.push({label,notches:i+1,upperSpacing:ug[i],lowerSpacing:lg[i],upperWidth:upper.width,lowerWidth:lower.width,upperEnabled:upper.enabled,lowerEnabled:lower.enabled,bounds:[[x,-6,0],[x+28,22,top]]});
  }finally{made?.shape?.delete();made?.blockers?.forEach(s=>s.delete());model?.delete();parts.forEach(s=>s.delete());notches.forEach(s=>s.delete());}
 }
 const report=inspectPrintSupportPackage(pkg);if(!report.ok)throw Error('試験片3MFの面の接続に問題があります：'+report.issues.map(i=>i.message).join('。'));return {trialPackage:pkg,trialAnalysis:{variants,layerHeight:p.layerHeight,topGap:p.topGap,wallPitch:8,bounds:[[0,-6,0],[104,22,top]],report}};
}
