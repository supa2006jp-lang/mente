import {dimensionLabel,dimensionLabelWidth,drawingDimensionGeometry} from './drawing-dimensions.js';
import {drawingModelPoint,drawingPaperPoint} from './drawing-break.js';

const dimensionsByView=dimensions=>{
 const groups=new Map();
 for(const d of dimensions){
  if(!groups.has(d.view))groups.set(d.view,[]);
  groups.get(d.view).push(d);
 }
 return groups;
};
const pointKey=point=>point.map(value=>Number(value.toFixed(4))).join(',');
function referenceKey(d){
 if(d.center)return JSON.stringify([d.kind,pointKey(d.center),Number(d.radius.toFixed(4)),d.count??1]);
 const ends=[pointKey(d.a),pointKey(d.b)].sort();
 return JSON.stringify([d.kind,...ends,d.vertex&&pointKey(d.vertex),d.repeat?.count]);
}
function fitsDetail(d,{center,radius}){
 const distance=([x,y])=>Math.hypot(x-center[0],y-center[1]);
 if(d.center)return (d.centers??[d.center]).every(point=>distance(point)+d.radius<=radius+1e-6);
 return (d.vertex?[d.a,d.b,d.vertex]:[d.a,d.b]).every(point=>distance(point)<=radius+1e-6);
}

function keepDetailLabelNearby(d,detail,view){
 const geometry=drawingDimensionGeometry(d,view);
 if(!geometry)return d;
 const center=drawingPaperPoint(view,detail.center);
 const delta=geometry.at.map((value,axis)=>value-center[axis]);
 const font=d.fontSize??3.2,halfWidth=dimensionLabelWidth(dimensionLabel(d),font)/2;
 const distance=Math.hypot(...delta),limit=detail.radius*view.scale+Math.max(4,Math.hypot(halfWidth,font*.75)+1);
 if(distance<=limit)return d;

 // The detail scales the measured geometry. Keep a distant label near its
 // circular region, while preserving the original measurement and leader angle.
 if(geometry.arc){
  const {center:vertex,radius}=geometry.arc;
  const unit=geometry.at.map((value,axis)=>(value-vertex[axis])/radius);
  const fromCenter=vertex.map((value,axis)=>value-center[axis]);
  const along=fromCenter[0]*unit[0]+fromCenter[1]*unit[1];
  const length=Math.sqrt(Math.max(0,limit**2-fromCenter[0]**2-fromCenter[1]**2+along**2))-along;
  return {...d,at:drawingModelPoint(view,vertex.map((value,axis)=>value+length*unit[axis]))};
 }
 const label=center.map((value,axis)=>value+delta[axis]*limit/distance);
 const at=drawingModelPoint(view,label);
 if(!geometry.direction)return {...d,at};
 const offset=geometry.direction.reduce((sum,value,axis)=>sum+value*(label[axis]-geometry.at[axis]),0);
 return {...d,at,alongOffset:(d.alongOffset??0)+offset/view.scale};
}

// Derive copies from the source dimensions. Page assignment can put the
// original and the detail on different sheets, so use the complete source.
export function drawingDetailDimensions(layout,details,sources){
 if(!details?.length)return [];
 const byView=dimensionsByView(sources),copies=[];
 for(const detail of details){
  const view=layout[detail.id];
  if(!view)continue;
  const used=new Set((byView.get(detail.id)??[]).map(referenceKey));
  for(const d of byView.get(detail.view)??[]){
   if(d.hidden||d.review||!fitsDetail(d,detail))continue;
   const key=referenceKey(d);
   if(used.has(key))continue;
   used.add(key);
   copies.push(keepDetailLabelNearby({...d,view:detail.id},detail,view));
  }
 }
 return copies;
}
