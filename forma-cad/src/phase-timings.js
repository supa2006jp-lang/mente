export const phaseLabels={geometry:'隙間・形状作成',inspection:'形状・隙間検査',display:'表示データ作成',save:'保存用データ作成',other:'モデル準備・その他'};
let active=null;
export class PhaseTimings{
 constructor(now=()=>performance.now()){this.now=now;this.started=now();this.phases={};this.stack=[];}
 measure(key,work){
  const frame={started:this.now(),children:0};this.stack.push(frame);
  try{return work();}finally{
   const elapsed=Math.max(0,this.now()-frame.started);this.stack.pop();
   this.phases[key]=(this.phases[key]||0)+Math.max(0,elapsed-frame.children);
   const parent=this.stack.at(-1);if(parent)parent.children+=elapsed;
  }
 }
 report(){
  const totalMs=Math.max(0,this.now()-this.started),phases={...this.phases};
  phases.other=(phases.other||0)+Math.max(0,totalMs-Object.values(phases).reduce((sum,value)=>sum+value,0));
  return {totalMs,phases};
 }
}
export function withPhaseTimings(timing,work){const previous=active;active=timing;try{return work();}finally{active=previous;}}
export function measurePhase(key,work){return active?active.measure(key,work):work();}
export function barrierTimingRequest(features,spec){
 const operation=spec?.type==='preview'?spec.operation:spec;
 return !!(operation?.feature?.barrier||operation?.features?.some(feature=>feature.barrier)||spec?.type==='replay'&&features.slice(spec.start||0).some(feature=>feature.barrier));
}
export function summarizeBarrierTimings(reports,elapsedMs){
 const phases=Object.fromEntries(Object.keys(phaseLabels).map(key=>[key,0]));let measured=0;
 for(const report of reports){if(!report||!Number.isFinite(report.totalMs))continue;measured+=report.totalMs;for(const key of Object.keys(phases))phases[key]+=Math.max(0,Number(report.phases?.[key])||0);}
 const totalMs=Math.max(0,elapsedMs,measured);
 return {totalMs,phases,waitingMs:Math.max(0,totalMs-measured)};
}
