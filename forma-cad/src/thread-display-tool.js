import {lightweightThreadBodies,applyThreadDisplayMeshes} from './mesh-quality.js';

export function createThreadDisplayTool({getFeatures,canUse,kernel,apply,notify}){
 const button=document.createElement('button');button.id='thread-display-tool';button.type='button';button.textContent='ねじを軽量表示';button.title='ねじのCAD形状を保ち、表示用データだけを軽くします。STLは保存時に精密な形状を作成します。';button.style.cssText='margin:6px 8px;width:calc(100% - 16px);font-size:12px';
 document.getElementById('body-complexity-tool').after(button);let revision=null,bodies=[],busy=false;
 function sync(){const features=getFeatures();if(features!==revision){revision=features;bodies=lightweightThreadBodies(features);}const hidden=!bodies.length&&!busy,disabled=busy||!bodies.length||!canUse(),label=busy?'ねじの表示を軽量化中…':'ねじを軽量表示';if(button.hidden!==hidden)button.hidden=hidden;if(button.disabled!==disabled)button.disabled=disabled;if(button.textContent!==label)button.textContent=label;}
 button.onclick=async()=>{
  if(busy||!canUse())return;const original=getFeatures(),targets=lightweightThreadBodies(original);if(!targets.length)return;
  busy=true;sync();try{const result=await kernel.run([],{type:'threadDisplayMeshes',bodies:targets});if(getFeatures()!==original||!canUse())return;const next=applyThreadDisplayMeshes(original,result);apply(next,original);notify('ねじのCAD形状を保持して、表示データを軽くしました');}
  catch(error){notify(error.message);}finally{busy=false;revision=null;sync();}
 };
 sync();return {sync};
}
