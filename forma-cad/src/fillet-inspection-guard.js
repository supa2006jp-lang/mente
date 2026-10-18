// A deadline inside synchronous WASM cannot interrupt Build(). This watchdog
// lives on the main thread, and only watches speculative partial-fillet trials.
export function createFilletInspectionGuard(spec,onTimeout,{delay=4000}={}){
 const operation=spec?.type==='preview'?spec.operation:spec;
 const enabled=operation?.type==='fillet'&&operation.partialMode==='offer';
 let timer=null,checkpoint=null;
 const clear=()=>{clearTimeout(timer);timer=null;};
 return {
  clear,
  progress(value){
   const {filletTrial,filletCheckpoint,...progress}=value;
   if(enabled){
    if(filletCheckpoint?.analysis?.partialFillet?.accepted>0&&filletCheckpoint.outputs?.length)checkpoint=filletCheckpoint;
    if(filletTrial==='end')clear();
    else if(filletTrial==='start'){clear();timer=setTimeout(()=>{timer=null;onTimeout();},delay);}
   }
   return progress;
  },
  result(){
   if(!checkpoint)return null;
   const result=structuredClone(checkpoint);result.analysis.partialFillet.limitReason='trial-time';
   return result;
  }
 };
}
