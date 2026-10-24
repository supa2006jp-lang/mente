// Check the actual Float32 coordinates written to binary STL, per body.
// Do not weld nearby points: a small intentional gap must remain a gap.
export function inspectStlMesh(mesh,{maxTriangles=400000,maxSegments=300}={}){
 const v=mesh.vertices,t=mesh.triangles,issues=[],segments=[],counts={boundary:0,nonmanifold:0,orientation:0,duplicate:0};
 const failure=code=>({ok:false,complete:true,triangles:0,removedDegenerate:0,counts,issues:[{code}],segments,volume:0});
 if(!Array.isArray(v)||!Array.isArray(t)||!v.length||v.length%3||!t.length||t.length%3)return failure('invalid-mesh');
 if(t.length/3>maxTriangles)return {...failure('inspection-limit'),complete:false,triangles:t.length/3};
 const ids=new Map(),points=[],vertexIds=new Int32Array(v.length/3),edges=new Map(),faces=new Set(),clean=[];let removedDegenerate=0,volume=0;
 for(let i=0;i<v.length;i+=3){const p=v.slice(i,i+3).map(Math.fround);if(!p.every(Number.isFinite))return failure('invalid-coordinate');const key=p.join(',');let id=ids.get(key);if(id===undefined){id=points.length;points.push(p);ids.set(key,id);}vertexIds[i/3]=id;}
 // A local origin avoids cancellation in volume sums for translated small parts.
 const origin=points[0];
 for(let i=0;i<t.length;i+=3){const indices=t.slice(i,i+3);if(!indices.every(n=>Number.isInteger(n)&&n>=0&&n<vertexIds.length))return failure('invalid-index');const abc=indices.map(n=>vertexIds[n]),[a,b,c]=abc.map(n=>points[n]),u=b.map((x,k)=>x-a[k]),w=c.map((x,k)=>x-a[k]);
  if(u[1]*w[2]-u[2]*w[1]===0&&u[2]*w[0]-u[0]*w[2]===0&&u[0]*w[1]-u[1]*w[0]===0){removedDegenerate++;continue;}
  clean.push(...indices);const face=[...abc].sort((a,b)=>a-b).join(',');if(faces.has(face))counts.duplicate++;faces.add(face);
  const aa=a.map((x,k)=>x-origin[k]),bb=b.map((x,k)=>x-origin[k]),cc=c.map((x,k)=>x-origin[k]);volume+=(aa[0]*(bb[1]*cc[2]-bb[2]*cc[1])+aa[1]*(bb[2]*cc[0]-bb[0]*cc[2])+aa[2]*(bb[0]*cc[1]-bb[1]*cc[0]))/6;
  for(let j=0;j<3;j++){const x=abc[j],y=abc[(j+1)%3],lo=Math.min(x,y),hi=Math.max(x,y),key=lo+','+hi;let e=edges.get(key);if(!e){e={a:lo,b:hi,count:0,sign:0};edges.set(key,e);}e.count++;e.sign+=x<y?1:-1;}
 }
 for(const e of edges.values()){const code=e.count===1?'boundary':e.count>2?'nonmanifold':e.sign!==0?'orientation':null;if(!code)continue;counts[code]++;if(segments.length<maxSegments*6)segments.push(...points[e.a],...points[e.b]);}
 for(const code of Object.keys(counts))if(counts[code])issues.push({code,count:counts[code]});
 if(!clean.length)issues.push({code:'empty-mesh'});else if(!issues.length&&!(volume>0))issues.push({code:volume<0?'inverted':'zero-volume'});
 return {ok:!issues.length,complete:true,triangles:clean.length/3,removedDegenerate,counts,issues,segments,segmentsTruncated:Object.values(counts).reduce((a,b)=>a+b,0)>maxSegments,volume,...(removedDegenerate?{cleanTriangles:clean}:{})};
}

export function stlInspectionSummary(rows){return {version:1,ok:rows.length>0&&rows.every(r=>r.ok),complete:rows.every(r=>r.complete),rows,checkedBodies:rows.length,repairedBodies:rows.filter(r=>r.repaired).length,removedDegenerate:rows.reduce((n,r)=>n+r.removedDegenerate,0)};}
