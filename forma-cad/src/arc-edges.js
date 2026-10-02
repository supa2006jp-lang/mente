import * as THREE from 'three';

function fitCircle(a,b,c){
 const u=b.clone().sub(a),v=c.clone().sub(a),w=u.clone().cross(v),denom=2*w.lengthSq();
 if(denom<1e-14)return null;
 const center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/denom)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/denom));
 return {center,radius:center.distanceTo(a),normal:w.normalize()};
}

// Display triangles split a cut circular rim into chords. Recover each connected
// open arc, keeping its closing straight edge and other rims separate.
export function arcEdges(geometry){
 const attr=geometry.attributes.position,nodes=new Map(),result=new Map(),used=new Set();
 const node=p=>{const key=p.toArray().map(v=>Math.round(v*1e4)).join(',');if(!nodes.has(key))nodes.set(key,{p,edges:[]});return nodes.get(key);};
 for(let i=0;i<attr.count;i+=2){if(geometry.userData.circularEdges?.has(i))continue;const a=node(new THREE.Vector3().fromBufferAttribute(attr,i)),b=node(new THREE.Vector3().fromBufferAttribute(attr,i+1));if(a===b)continue;const edge={a,b,index:i};a.edges.push(edge);b.edges.push(edge);}
 for(const middle of nodes.values())for(let i=0;i<middle.edges.length;i++)for(let j=i+1;j<middle.edges.length;j++){
  const first=middle.edges[i],second=middle.edges[j];if(used.has(first)||used.has(second))continue;
  const a=(first.a===middle?first.b:first.a).p,b=middle.p,c=(second.a===middle?second.b:second.a).p;
  const bend=b.clone().sub(a).angleTo(c.clone().sub(b));if(bend<1e-5||bend>.2)continue;
  const fit=fitCircle(a,b,c);if(!fit||fit.radius<.001||fit.radius>100000)continue;
  const {center,radius,normal}=fit,tol=Math.max(.0002,radius*(.0002+1-Math.cos(bend/2)));
  const matches=p=>Math.abs(p.distanceTo(center)-radius)<tol&&Math.abs(p.clone().sub(center).dot(normal))<tol;
  const found=new Set(),queue=[first,second];
  while(queue.length){const edge=queue.pop();if(found.has(edge)||used.has(edge)||!matches(edge.a.p)||!matches(edge.b.p)||edge.a.p.distanceTo(edge.b.p)>radius*.2)continue;found.add(edge);for(const n of [edge.a,edge.b])for(const next of n.edges){if(found.has(next))continue;const incoming=n.p.clone().sub((edge.a===n?edge.b:edge.a).p),outgoing=(next.a===n?next.b:next.a).p.clone().sub(n.p);if(incoming.angleTo(outgoing)<=.2)queue.push(next);}}
  if(found.size<6)continue;
  const connected=n=>n.edges.filter(e=>found.has(e)),ends=[...new Set([...found].flatMap(e=>[e.a,e.b]))].filter(n=>connected(n).length===1);
  if(ends.length!==2||[...found].some(e=>connected(e.a).length>2||connected(e.b).length>2))continue;
  const points=[ends[0].p],chain=[];let current=ends[0],previous=null;
  while(true){const edge=connected(current).find(e=>e!==previous);if(!edge)break;chain.push(edge);current=edge.a===current?edge.b:edge.a;points.push(current.p);previous=edge;}
  if(chain.length!==found.size)continue;
  const refined=fitCircle(points[Math.floor(points.length/4)],points[Math.floor(points.length/2)],points[Math.floor(points.length*3/4)]);if(!refined)continue;
  const tolerance=Math.max(.0002,refined.radius*(.0002+1-Math.cos(bend/2)));
  if(points.some(p=>Math.abs(p.distanceTo(refined.center)-refined.radius)>tolerance||Math.abs(p.clone().sub(refined.center).dot(refined.normal))>tolerance))continue;
  let sweep=0,valid=true;
  for(let k=1;k<points.length;k++){const u=points[k-1].clone().sub(refined.center),v=points[k].clone().sub(refined.center),angle=Math.atan2(u.clone().cross(v).dot(refined.normal),u.dot(v));if(angle<=0||angle>.2){valid=false;break;}sweep+=angle;}
  if(!valid||sweep<.35||sweep>=Math.PI*2-.001)continue;
  const arc={radius:refined.radius,center:refined.center.toArray(),length:refined.radius*sweep,sweep,points:points.map(p=>p.toArray()),key:chain.map(e=>e.index).sort((a,b)=>a-b).join(',')};
  for(const edge of chain){result.set(edge.index,arc);used.add(edge);}
 }
 return result;
}
