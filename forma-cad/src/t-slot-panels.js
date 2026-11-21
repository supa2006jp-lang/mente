import {Box3,Matrix4,Vector3} from 'three';
import {PRINT_PLATE_SIZE} from './print-layout.js';
import {framePartBounds,plateKey} from './t-slot-frame.js';

export const panelFaces=[
  {id:'top',label:'上面',u:0,v:1,n:2,sign:1},
  {id:'front',label:'前面',u:0,v:2,n:1,sign:-1},{id:'back',label:'背面',u:0,v:2,n:1,sign:1},
  {id:'left',label:'左面',u:1,v:2,n:0,sign:-1},{id:'right',label:'右面',u:1,v:2,n:0,sign:1},
  {id:'bottom',label:'下面',u:0,v:1,n:2,sign:-1}
];
export const PANEL_THICKNESS=2,PANEL_HOLE_RADIUS=4.5;
export const panelBacking={kind:'panel',key:'panel-join',name:'透明板の継ぎ板 42 × 18 × 2 mm',
  outline:[[0,0],[42,0],[42,18],[0,18]],holes:[[9,9],[33,9]],bounds:[[0,0,0],[42,18,PANEL_THICKNESS]]};
const edgeGap=.5,jointDepth=5,seamGap=.25;
const round=n=>Math.round(n*1e6)/1e6;
const boxOf=(lo,hi)=>new Box3(new Vector3(...lo),new Vector3(...hi));
const hits=(a,b)=>[ 'x','y','z' ].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>.001);

function mountingGeometry(box,assembly){
  const axes=box.axes.map(a=>new Vector3(...a)),origin=new Vector3(...box.origin);
  axes.forEach((axis,i)=>origin.addScaledVector(axis,-assembly.clearance[i]));
  const basis=new Matrix4().makeBasis(...axes).setPosition(origin);
  const inverse=basis.invert(),obstacles=[],seats=[],slots=[];
  for(const part of assembly.parts){
    if(part.kind==='rail')continue;
    const matrix=inverse.clone().multiply(part.matrix),[lo,hi]=framePartBounds(part);
    function slot(point,normal){
      slots.push({point:new Vector3(...point).applyMatrix4(matrix),normal:new Vector3(...normal).transformDirection(matrix)});
    }
    if(part.kind==='corner'){
      for(const [min,max] of [[[0,-.65,0],[38,8,24]],[[-.65,0,0],[8,38,24]],[[7,7,0],[35,35,3.6]],
        [[7.5,7.5,3.6],[20.5,20.5,8]],[[8,19.65,4.65],[13.6,34.35,19.35]],[[19.65,8,4.65],[34.35,13.6,19.35]]])
        obstacles.push(boxOf(min,max).applyMatrix4(matrix));
      slot([0,27,12],[1,0,0]);slot([27,0,12],[0,1,0]);
    }else{
      const solid=boxOf(lo,hi);
      if(plateKey(part))solid.min.z-=5.6;else solid.max.z+=5.6;
      obstacles.push(solid.applyMatrix4(matrix));
      const keyed=!!plateKey(part),xs=part.span===undefined?[-34,-12,12,34]:
        part.shared?[-part.span/2,0,part.span/2]:[-part.span/2,part.span/2];
      for(const x of xs)slot([x,0,keyed?8:0],[0,0,keyed?-1:1]);
    }
    if(part.panelHole)seats.push({point:new Vector3(14,14,0).applyMatrix4(matrix).toArray(),
      normal:new Vector3(0,0,-1).transformDirection(matrix).toArray()});
  }
  return {obstacles,seats,slots};
}
function faceBox(face,plane,u0,v0,z0,u1,v1,z1){
  const lo=[],hi=[];
  lo[face.u]=u0;hi[face.u]=u1;lo[face.v]=v0;hi[face.v]=v1;
  const a=plane+face.sign*z0,b=plane+face.sign*z1;
  lo[face.n]=Math.min(a,b);hi[face.n]=Math.max(a,b);
  return boxOf(lo,hi);
}
function faceSlot(face,plane,u,v,z,axis,sign){
  const point=faceBox(face,plane,u,v,z,u,v,z).min;
  return {point,normal:new Vector3().setComponent(axis,sign)};
}
function slotOccupied(a,b){
  if(a.normal.dot(b.normal)<.999)return false;
  const d=a.point.clone().sub(b.point);
  return Math.abs(d.dot(a.normal))<.01&&Math.max(Math.abs(d.x),Math.abs(d.y),Math.abs(d.z))<19.81;
}
function nutFitsSegment(along,axis,run){
  const at=(along+(axis===2?28:0))/run.length;
  return Math.abs(at-Math.round(at))*run.length>=9.91;
}
function innerBracket(face,plane,w,h,highU,highV,runs){
  if(w<38||h<38)return null;
  const u=x=>highU?w-x:x,v=y=>highV?h-y:y;
  if(!nutFitsSegment(u(27),face.u,runs[face.u])||!nutFitsSegment(v(27),face.v,runs[face.v]))return null;
  const rect=(x,y,z,a,b,c)=>faceBox(face,plane,Math.min(u(x),u(a)),Math.min(v(y),v(b)),z,
    Math.max(u(x),u(a)),Math.max(v(y),v(b)),c);
  return {hole:[u(14),v(14)],extraCorner:true,
    boxes:[rect(0,0,-26,38,8,-2),rect(0,0,-26,8,38,-2),rect(7,7,-5.6,35,35,-2),
      rect(7.5,7.5,-10,20.5,20.5,-2),rect(19.65,8,-21.35,34.35,13.6,-6.65),rect(8,19.65,-21.35,13.6,34.35,-6.65)],
    slots:[faceSlot(face,plane,u(27),v(0),-14,face.v,highV?-1:1),faceSlot(face,plane,u(0),v(27),-14,face.u,highU?-1:1)]};
}
// Bridge a missing seat with an 8 mm strap across the outer frame slot and
// the flush panel. Each end takes an M8×16 and a T-nut, one behind the panel.
function clampCandidates(face,plane,w,h,highU,highV,runs){
  const options=[];
  for(const alongU of [true,false]){
    const axis=alongU?face.u:face.v,span=alongU?w:h,depth=alongU?h:w;
    const run=runs[axis];
    const alongHigh=alongU?highU:highV,depthHigh=alongU?highV:highU;
    const distances=[14,10,18,22,26,30,34,38,42,46,50,54,58];
    for(const d of distances){
      if(d>span/2||14>depth/2)continue;
      const along=alongHigh?span-d:d,inside=depthHigh?depth-14:14,anchor=depthHigh?depth+14:-14;
      if(!nutFitsSegment(along,axis,run))continue;
      const rect=(a,b,c,e,z0,z1)=>alongU?faceBox(face,plane,a,b,z0,c,e,z1):faceBox(face,plane,b,a,z0,e,c,z1);
      const body=rect(along-9,Math.min(inside,anchor)-9,along+9,Math.max(inside,anchor)+9,0,13.6);
      const backingNut=rect(along-7,inside-10,along+7,inside+10,-8.2,-2);
      const hole=alongU?[along,inside]:[inside,along];
      const railPoint=alongU?[along,anchor]:[anchor,along];
      options.push({hole,anchor:railPoint,boxes:[body,backingNut],distance:d,slots:[faceSlot(face,plane,...railPoint,0,face.n,face.sign)]});
    }
  }
  return options.sort((a,b)=>Math.abs(a.distance-14)-Math.abs(b.distance-14));
}
function locatePanel(face,box,assembly,{seats,obstacles,slots}){
  const size=box.size.map((v,i)=>v+2*assembly.clearance[i]),w=size[face.u],h=size[face.v],plane=face.sign>0?size[face.n]+28:-28;
  const own=seats.filter(s=>s.normal[face.n]*face.sign>.999&&Math.abs(s.point[face.n]-(plane-2*face.sign))<.01);
  const corners=[[false,false],[true,false],[false,true],[true,true]];
  const error=()=>Error(face.label+'の四隅にM8の穴と固定部品を配置する空間がありません（開口 '+w+' × '+h+' mm）。');
  const options=corners.map(([highU,highV])=>{
    const target=[highU?w-14:14,highV?h-14:14];
    const seat=own.find(s=>Math.abs(s.point[face.u]-target[0])<.01&&Math.abs(s.point[face.v]-target[1])<.01);
    if(seat)return [{hole:target,boxes:[],slots:[]}];
    return [innerBracket(face,plane,w,h,highU,highV,assembly.runs),...clampCandidates(face,plane,w,h,highU,highV,assembly.runs)]
      .filter(o=>o&&o.boxes.every(bounds=>obstacles.every(old=>!hits(bounds,old)))&&o.slots.every(s=>slots.every(t=>!slotOccupied(s,t))));
  });
  const chosen=[];
  function place(i){
    if(i===4)return true;
    for(const option of options[i]){
      if(chosen.some(other=>Math.hypot(other.hole[0]-option.hole[0],other.hole[1]-option.hole[1])<15||
        other.boxes.some(a=>option.boxes.some(b=>hits(a,b)))||other.slots.some(s=>option.slots.some(t=>slotOccupied(s,t)))))continue;
      chosen.push(option);if(place(i+1))return true;chosen.pop();
    }
    return false;
  }
  if(!place(0))throw error();
  for(const option of chosen){obstacles.push(...option.boxes);slots.push(...option.slots);}
  return {face,width:round(w-2*edgeGap),height:round(h-2*edgeGap),mounts:chosen.map(({hole,anchor,extraCorner})=>({
    hole:hole.map(v=>round(v-edgeGap)),...(extraCorner?{extraCorner:true}:{}),...(anchor?{anchor:anchor.map(v=>round(v-edgeGap))}:{})
  }))};
}
// Both sides of a seam use the same tooth centers. The socket is deeper and
// wider than the tongue, allowing the parts to drop together from above.
function edgePath(start,end,span,joint,base,point){
  const out=[point(start,base)];
  if(joint){
    const socket=joint==='socket',allow=socket?.22:0,tip=base+jointDepth+(socket?.15:0);
    const teeth=Math.max(1,Math.floor(span/48));
    for(let i=0;i<teeth;i++){
      const s=(i+.5)*span/teeth,neck=3.7+allow,head=6+allow;
      for(const [along,offset] of [[s-neck,base],[s-head,tip-.6],[s-head+.6,tip],[s+head-.6,tip],[s+head,tip-.6],[s+neck,base]])
        out.push(point(along,offset));
    }
  }
  out.push(point(end,base));return out;
}
// The first tile has one tongue and loses half the seam gap at its base.
const nPieces=span=>span<=PRINT_PLATE_SIZE?1:Math.ceil(span/(PRINT_PLATE_SIZE-jointDepth+seamGap/2));
export function panelTiles({face,width,height,mounts}){
  const cols=nPieces(width),rows=nPieces(height),parts=[];
  if(cols*rows>10000)throw Error('1面の分割が10000枚を超えます。板の寸法を確認してください。');
  const w=width/cols,h=height/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const left=col>0,right=col<cols-1,bottom=row>0,top=row<rows-1;
    const x0=left?seamGap/2:0,x1=w-(right?seamGap/2:0),y0=bottom?seamGap/2:0,y1=h-(top?seamGap/2:0);
    const xy=(x,y)=>[round(x),round(y)],yx=(y,x)=>xy(x,y);
    const edges=[edgePath(x0,x1,w,bottom&&'socket',y0,xy),edgePath(y0,y1,h,right&&'tongue',x1,yx),
      edgePath(x0,x1,w,top&&'tongue',y1,xy).reverse(),edgePath(y0,y1,h,left&&'socket',x0,yx).reverse()];
    const outline=edges.flatMap(edge=>edge.slice(0,-1));
    const holes=mounts.map(m=>m.hole).filter(([x,y])=>Math.floor(x/w)===col&&Math.floor(y/h)===row)
      .map(([x,y])=>xy(x-col*w,y-row*h));
    // A two-hole backing strip keeps the drop-in dovetail from lifting or
    // falling out of a horizontal panel. Adjacent tiles share one strip.
    if(left)holes.push(xy(12,h/2));if(right)holes.push(xy(w-12,h/2));
    if(bottom)holes.push(xy(w/2,12));if(top)holes.push(xy(w/2,h-12));
    const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
    const bounds=[[Math.min(...xs),Math.min(...ys),0],[Math.max(...xs),Math.max(...ys),PANEL_THICKNESS]];
    const name=face.label+' 透明板 '+width+' × '+height+' × 2 mm'+(rows*cols>1?'（'+(row+1)+'行'+(col+1)+'列／'+rows+'行'+cols+'列）':'');
    const key=['panel',face.id,width,height,row,col,...holes.flat()].join('-');
    parts.push({kind:'panel',name,key,outline,holes,bounds,count:1});
  }
  return parts;
}
export function framePanels(box,assembly,selected){
  const bill=[],plans=[];
  if(!selected.length)return {bill,plans};
  const environment=mountingGeometry(box,assembly);
  for(const face of panelFaces.filter(f=>selected.includes(f.id))){
    const plan=locatePanel(face,box,assembly,environment),tiles=panelTiles(plan);
    const clamps=plan.mounts.filter(m=>m.anchor).length;
    const corners=plan.mounts.filter(m=>m.extraCorner).length;
    bill.push(...tiles);
    if(corners)bill.push({kind:'corner',panelHole:true,count:corners},{kind:'bolt',count:2*corners},{kind:'nut',count:2*corners});
    if(clamps)bill.push({kind:'panelClamp',span:28,count:clamps},{kind:'bolt',count:clamps*2},{kind:'nut',count:clamps*2});
    if(clamps<4)bill.push({kind:'bolt',length:10,count:4-clamps});
    const cols=nPieces(plan.width),rows=nPieces(plan.height),joints=(cols-1)*rows+(rows-1)*cols;
    if(joints)bill.push({...panelBacking,count:joints},
      {kind:'bolt',length:10,count:2*joints},{kind:'nut',count:2*joints});
    plans.push({...plan,cols,rows,pieces:tiles.length});
  }
  return {bill,plans};
}

export function panelAssemblyNotes(plans){
  const lines=['透明板の組立（単位 mm）','ファイル名に -clear が付くプレートには透明PETGを使います。',
    '板厚は2 mm、通し穴は直径9 mmです。穴の座標は完成した板の端を原点とします。',
    '上面・下面の座標は（幅, 奥行き）、前面・背面は（幅, 高さ）、左面・右面は（奥行き, 高さ）です。',
    '分割片の列と行はそれぞれ第1座標、第2座標が小さい順です。',
    '分割片を平らに置いて台形の継ぎ手を上からはめ、継ぎ目の穴2個に裏から透明な継ぎ板を当てます。首下10 mmボルト2本とT溝ナット2個で固定します。',
    '角のブラケットには板の表から首下10 mmボルトを留めます。押さえプレートは枠と板の表側に渡し、首下16 mmボルトを両端に通し、枠の溝と板の裏でそれぞれT溝ナットに留めます。'];
  for(const {source,face,width,height,cols,rows,mounts} of plans){
    lines.push('',(source?source+' ／ ':'')+face.label+'　'+width+' × '+height+'　'+cols+'列 × '+rows+'行');
    for(const {hole,anchor,extraCorner} of mounts)lines.push('板穴 ('+hole.join(', ')+')　'+(anchor?'押さえプレート → 枠の溝 ('+anchor.join(', ')+')':
      extraCorner?'追加の直角ブラケット（板受けを外向きにし、両脚を首下16 mmと溝ナットで固定）':'既設の直角ブラケットのM8ねじ穴'));
  }
  return lines.join('\r\n')+'\r\n';
}
