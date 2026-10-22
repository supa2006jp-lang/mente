import {MODEL_PRECISION as P} from './model-precision.js';

// Native face/edge indices change during booleans. Match observations by their
// geometry instead, and never call an unmatched finding new after a partial scan.
function same(a,b){
 if(a.code!==b.code||a.otherId!==b.otherId)return false;
 if(a.code==='disconnected')return a.count===b.count;
 if(Number.isFinite(a.size)&&Math.abs(a.size-b.size)>Math.max(P.contact,Math.abs(a.size)*1e-5))return false;
 if(!a.bounds||!b.bounds)return false;
 return a.bounds.every((p,i)=>p.every((v,k)=>Math.abs(v-b.bounds[i][k])<=Math.max(P.contact,Math.abs(v)*1e-9)));
}
export function classifyHealthFindings(row,baselines=[]){
 const unmatched=baselines.flatMap(r=>r.findings).slice(),complete=baselines.length>0&&baselines.every(r=>!r.partial);
 const findings=row.findings.map(f=>{const i=unmatched.findIndex(b=>same(f,b));if(i>=0){unmatched.splice(i,1);return {...f,change:'existing'};}return {...f,change:complete?'new':'unknown'};});
 return {...row,findings,comparison:{complete,new:findings.filter(f=>f.change==='new').length,existing:findings.filter(f=>f.change==='existing').length,unknown:findings.filter(f=>f.change==='unknown').length}};
}
