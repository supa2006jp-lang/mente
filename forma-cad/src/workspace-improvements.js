import {installCommandSelection} from './command-selection.js';
import {createHistoryImpactView} from './history-impact-view.js';
import {createCadFailureView} from './cad-failure-view.js';
import {installKernelActivityView} from './kernel-activity-view.js';
import {createPrintPreflightView} from './print-preflight-view.js';
import {installInteractionDetail} from './interaction-detail.js';
import {createBodyComplexityView} from './body-complexity-view.js';
import {createModelTools} from './model-tools-view.js';
export function installWorkspaceImprovements(context){
 const style=document.createElement('style');style.textContent='.workspace-panel{position:fixed;right:16px;bottom:16px;z-index:105;width:min(410px,calc(100vw - 32px));box-sizing:border-box;max-height:70vh;overflow:auto;padding:14px;border:1px solid #8eaabc;border-radius:8px;background:#f6fbff;color:#173b50;box-shadow:0 8px 24px #14223233;font-size:13px;line-height:1.5}.workspace-panel[hidden]{display:none}.workspace-panel input[type=number]{width:100%;box-sizing:border-box;padding:6px;background:white;color:#173b50;border:1px solid #8eaabc;border-radius:4px}.workspace-panel label{color:#173b50;display:block;margin:6px 0;min-width:0}.workspace-panel .hint{font-size:12px;color:#506a7b}.workspace-actions{display:flex;flex-wrap:wrap;gap:6px}.workspace-panel button,#history-impact-panel button{padding:7px 9px;background:#e4f2f8;color:#173b50;border:1px solid #8eaabc;border-radius:4px}#kernel-activity-panel{position:fixed;width:340px;left:16px;right:auto;top:auto;bottom:16px;margin:0;max-height:190px;z-index:220}#cad-failure-panel{border-color:#d66a5d}';document.head.append(style);
 const history=createHistoryImpactView(context),failure=createCadFailureView({...context,onFeature:context.onSelect}),selection=installCommandSelection({getState:context.getSelectionState,notify:context.notify});
 const activity=installKernelActivityView({...context,onFailure:(error,spec,features)=>{failure.show(error,spec,features);history.failure(error);},onSuccess:()=>failure.clear()});
 const preflight=createPrintPreflightView({...context,onOpen:()=>{modelTools.close();context.onOpen?.();},inspectComponents:(features,targets)=>modelTools.inspect(features,targets),openComponents:()=>modelTools.open('components')}),detail=installInteractionDetail(context);
 const complexity=createBodyComplexityView({...context,onOpen:()=>{modelTools.close();preflight.close();context.onOpen?.();}});
 const modelTools=createModelTools({...context,onToolOpen:()=>{preflight.close();complexity.close();history.close();failure.clear();}});
 let lastSync=0,connectionSeen=null;
 return {history,preflight,failure,activity,complexity,modelTools,sync(){if(Date.now()-lastSync<150)return;lastSync=Date.now();selection.sync();history.sync();failure.sync();preflight.sync();complexity.sync();modelTools.sync();const current=context.getFeatures(),last=current.at(-1),check=(last?.cadResult?.analysis||last?.analysis)?.connectionCheck;if(connectionSeen!==current&&context.canOpen()){connectionSeen=current;if(check?.bodies.some(body=>body.count>1))modelTools.open('components',{joinWarning:true});}},beforeModelChange(){modelTools.beforeModelChange();failure.clear();history.close();preflight.close();complexity.close();detail.restore();}};
}
