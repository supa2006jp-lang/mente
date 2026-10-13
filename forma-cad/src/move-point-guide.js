export const movePointDistanceText=distance=>distance.toFixed(2)+' mm';

export function movePointGuide(source,target,camera,width,height){
 const project=point=>{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
 const start=project(source);if(start.z< -1||start.z>1)return null;
 const end=target?project(target):null,distance=target?source.distanceTo(target):null;
 return {source:start,target:end,distance,text:distance===null?'':movePointDistanceText(distance)};
}

export function drawMovePointGuide(create,parent,guide){
 if(!guide)return;
 const {source:a,target:b}=guide,blue='#1679bf',orange='#d56b00';
 const text=(value,x,y,color,anchor='start')=>{const el=create('text',{x,y,fill:color,stroke:'white','stroke-width':3,'paint-order':'stroke','text-anchor':anchor,'font-size':13,'font-weight':700},parent);el.textContent=value;};
 if(b){
  const d='M'+a.x+' '+a.y+'L'+b.x+' '+b.y;create('path',{d,fill:'none',stroke:'white','stroke-width':5},parent);create('path',{d,fill:'none',stroke:blue,'stroke-width':2,'stroke-dasharray':'6 4'},parent);
  const x=(a.x+b.x)/2,y=Math.min(a.y,b.y)-36;create('rect',{x:x-78,y:y-17,width:156,height:24,rx:5,fill:'white',stroke:blue},parent);const label=create('text',{x,y,fill:'#163f60','text-anchor':'middle','font-size':13,'font-weight':700},parent);label.textContent='移動距離 '+guide.text;
 }
 create('circle',{cx:a.x,cy:a.y,r:8,fill:blue,stroke:'white','stroke-width':2},parent);text('移動元',a.x-12,a.y+22,blue,'end');
 if(b&&guide.distance>1e-8){create('circle',{cx:b.x,cy:b.y,r:7,fill:orange,stroke:'white','stroke-width':2},parent);text('移動先',b.x+12,b.y+22,orange);}
}
