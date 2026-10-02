// Pure support calculation for a circular receiver pocket in a convex profile.
// Phase is applied before the left-handed reflection.
const tau=2*Math.PI;
const mod=x=>(x%tau+tau)%tau;
function outwardEdges(profile){let area=0;for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length];area+=a[0]*b[1]-a[1]*b[0];}const sign=area>0?1:-1;return profile.map((a,i)=>{const b=profile[(i+1)%profile.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-9)throw Error('Degenerate profile edge');const normal=[sign*dy/length,-sign*dx/length];return {normal,offset:normal[0]*a[0]+normal[1]*a[1]};});}
function arcMaxCos(angle,a,b){const width=b-a;if(width>=tau-1e-10)return 1;const d=mod(angle-a);if(d<=width+1e-12)return 1;return Math.max(Math.cos(angle-a),Math.cos(angle-b));}
export function arcBacking(profile,outerRadius,a,b,innerRadius=0){if(b<a)throw Error('Arc bounds must be unwrapped');return Math.min(...outwardEdges(profile).map(({normal,offset})=>{const maxCos=arcMaxCos(Math.atan2(normal[1],normal[0]),a,b),radius=maxCos>=0?outerRadius:innerRadius;return offset-radius*maxCos;}));}
export function choosePocketPhase(q,d,minimum=1.2){
 const outer=d.toothOuter+d.c,a=d.toothA-d.c/d.inner,b=d.toothB+d.c/d.inner;
 if(!q.profile)return {phase:0,phaseDegrees:0,minimumBacking:q.radius-outer,requestedBacking:minimum,meetsMinimum:q.radius-outer>=minimum-1e-8};
 const evaluate=phase=>{const start=q.leftHand?-(phase+b):phase+a,end=q.leftHand?-(phase+a):phase+b;return arcBacking(q.profile,outer,start,end,d.inner-d.c);};let best={phase:0,minimumBacking:evaluate(0)};
 for(let degree=0;degree<360;degree++){const phase=degree*Math.PI/180,minimumBacking=evaluate(phase);if(minimumBacking>best.minimumBacking+1e-10)best={phase,minimumBacking};}
 // Resolve the final subdegree centering without relying on mesh samples.
 const seed=best.phase;for(let tenth=-10;tenth<=10;tenth++){const phase=mod(seed+tenth*Math.PI/1800),minimumBacking=evaluate(phase);if(minimumBacking>best.minimumBacking+1e-10)best={phase,minimumBacking};}
 const phase=best.phase>Math.PI?best.phase-tau:best.phase;
 return {phase,phaseDegrees:phase*180/Math.PI,minimumBacking:best.minimumBacking,requestedBacking:minimum,meetsMinimum:best.minimumBacking>=minimum-1e-8,actualArc:q.leftHand?[-(phase+b),-(phase+a)]:[phase+a,phase+b],pocketOuter:outer};
}
