import {planeCoordinates} from './regions.js';
import {basisFor,worldPoint} from './frames.js';

// Store ordinary, connected sketch lines with an open end; no wall or face.
export function channelSketch(feature,opening='left',reversed=false){
 const w=feature.width/2,h=feature.height/2,corners=[[-w,-h],[w,-h],[w,h],[-w,h]],start={left:0,down:1,right:2,up:3}[opening];
 if(start===undefined)throw Error('コの字の開く向きを選択してください');
 const o=planeCoordinates(feature),a=feature.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=Array.from({length:4},(_,i)=>{const [x,y]=corners[(start+i)%4];return [o.u+x*c-y*s,o.v+x*s+y*c];});
 return {...feature,profile:'polyline',closed:false,points:reversed?points.reverse():points};
}

// Read the actual lines, including older files and transformed copies. Never
// regenerate a changed or broken polyline from stale shape metadata.
export function channelParameters(f){
 if(f?.kind!=='sketch'||f.profile!=='polyline'||f.closed||f.arc||f.textOutline||!Array.isArray(f.points)||f.points.length!==4||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))return null;
 const p=f.points,e=p.slice(1).map((q,i)=>q.map((v,k)=>v-p[i][k])),length=e.map(v=>Math.hypot(...v)),tol=1e-6+Math.max(...length)*1e-9;
 if(length.some(v=>v<.1)||Math.hypot(e[0][0]+e[2][0],e[0][1]+e[2][1])>tol||Math.abs(e[0][0]*e[1][0]+e[0][1]*e[1][1])>length[0]*length[1]*1e-8)return null;
 const center=[0,1].map(k=>p.reduce((sum,q)=>sum+q[k]/4,0)),position=worldPoint({...f,offset:planeCoordinates(f).offset},center),angles=[f.angle??0,Math.atan2(e[0][1],e[0][0])*180/Math.PI];
 for(const angle of angles){
  if(!Number.isFinite(angle))continue;const a=-angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),local=p.map(q=>{const x=q[0]-center[0],y=q[1]-center[1];return [x*c-y*s,x*s+y*c];}),bounds=[0,1].map(k=>[Math.min(...local.map(q=>q[k])),Math.max(...local.map(q=>q[k]))]),width=bounds[0][1]-bounds[0][0],height=bounds[1][1]-bounds[1][0];if(width<.1||height<.1)continue;
  const prefer=(value,old)=>Number.isFinite(old)&&Math.abs(value-old)<=tol?old:value;
  const params={width:prefer(width,f.width),height:prefer(height,f.height),angle,x:prefer(position.x,f.x),y:prefer(position.y,f.y),z:prefer(position.z,f.z)};
  for(const opening of ['left','right','up','down'])for(const reversed of [false,true]){const candidate=channelSketch({...f,...params},opening,reversed);if(candidate.points.every((q,i)=>Math.hypot(q[0]-p[i][0],q[1]-p[i][1])<=tol))return {...params,opening,reversed};}
 }
 return null;
}

export function channelOpeningMarker(f){
 if(!channelParameters(f))return null;const p=f.points,opening=p[0].map((v,k)=>(v+p[3][k])/2),back=p[1].map((v,k)=>(v+p[2][k])/2),b=basisFor(f),direction=b.u.clone().multiplyScalar(opening[0]-back[0]).addScaledVector(b.v,opening[1]-back[1]).normalize();return {point:worldPoint({...f,offset:planeCoordinates(f).offset},opening),direction};
}
