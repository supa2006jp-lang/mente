import {Box3,Matrix4,Vector3} from 'three';

export function placementBox(at,x,y,z,lo,hi){
  const pose=new Matrix4().makeBasis(x,y,z).setPosition(at);
  return new Box3(new Vector3(...lo),new Vector3(...hi)).applyMatrix4(pose);
}

// Project the two 38 mm legs, their installed bolt heads and the triangular web
// onto the panel plane. Opposite corners can share many openings under 76 mm.
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const cornerFootprint=[rect(0,0,38,8),rect(0,0,8,38),
  rect(19.7,8,34.3,13.6),rect(8,19.7,13.6,34.3),[[8,8],[34.5,8],[8,34.5]]];
function separated(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const [x,y]=polygon[i],[u,v]=polygon[(i+1)%polygon.length];
    const length=Math.hypot(u-x,v-y),nx=(y-v)/length,ny=(u-x)/length;
    const project=points=>points.map(([p,q])=>p*nx+q*ny);
    const s=project(a),t=project(b);
    if(Math.max(...s)+.2<=Math.min(...t)||Math.max(...t)+.2<=Math.min(...s))return true;
  }
  return false;
}
export function innerCornerPositions(span,height){
  if(span<38||height<38)return new Set();
  if(span>=76&&height>=76)return new Set([0,1,2,3]);
  const opposite=cornerFootprint.map(poly=>poly.map(([x,y])=>[span-x,height-y]));
  const both=cornerFootprint.every(a=>opposite.every(b=>separated(a,b)));
  return new Set(both?[0,3]:[0]);
}

function overlaps(a,b){
  return a.min.x<b.max.x-1e-6&&a.max.x>b.min.x+1e-6&&a.min.y<b.max.y-1e-6&&a.max.y>b.min.y+1e-6&&
    a.min.z<b.max.z-1e-6&&a.max.z>b.min.z+1e-6;
}
function nutsClash(a,b){
  if(a.normal.dot(b.normal)<.99)return false;
  const d=a.point.clone().sub(b.point);
  return Math.abs(d.dot(a.normal))<.05&&Math.max(Math.abs(d.x),Math.abs(d.y),Math.abs(d.z))<20;
}
function candidates(joint,rails,fixtures,fixedNuts){
  const options=[];
  for(const [i,normal] of joint.normals.entries()){
    const at=joint.center.clone().addScaledVector(normal,14),across=normal.clone().cross(joint.along);
    const box=(lo,hi)=>placementBox(at,joint.along,across,normal,lo,hi);
    // Nuts in perpendicular T-slots are separated by the rail itself. Compare
    // the captive hardware only within the same face, and solid obstacles outside it.
    const nuts=[-13.5,13.5].map(x=>({normal,point:at.clone().addScaledVector(joint.along,x)}));
    if(nuts.some(n=>fixedNuts.some(f=>nutsClash(n,f))))continue;
    const body=box([-22.5,-11,.01],[22.5,11,13.8]);
    const access=box([-22.5,-11,.01],[22.5,11,22]);
    if(rails.some(r=>overlaps(access,r))||fixtures.some(f=>overlaps(body,f)||overlaps(access,f)))continue;
    options.push({at,normal,inside:i<2,body,access,nuts});
  }
  return options;
}
// Only the four parallel edges at the same seam can meet. Consecutive seams
// are at least 80 mm apart; seams on perpendicular edges are at least 94 mm
// apart along one axis. Choose the fewest exterior plates among these four.
export function planInteriorSplices(group,rails,fixtures,fixedNuts){
  const options=group.map(j=>candidates(j,rails,fixtures,fixedNuts)),selected=[];
  let best=null,bestExterior=Infinity;
  function choose(i,exterior){
    if(exterior>=bestExterior)return;
    if(i===group.length){best=[...selected];bestExterior=exterior;return;}
    for(const c of options[i]){
      if(selected.some(p=>overlaps(c.body,p.body)||overlaps(c.access,p.body)||overlaps(p.access,c.body)||
          c.nuts.some(n=>p.nuts.some(m=>nutsClash(n,m)))))continue;
      selected.push(c);choose(i+1,exterior+(c.inside?0:1));selected.pop();
    }
  }
  choose(0,0);
  if(!best)throw Error('直線連結プレートとM8ボルトを配置できる面がありません。');
  return best;
}
