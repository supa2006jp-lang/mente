import Clipper from 'clipper-lib';

export function validateProfileOffset(feature){
 if(feature.profileOffset===undefined)return;
 if(!Number.isFinite(feature.profileOffset)||Math.abs(feature.profileOffset)>10000)throw Error('OS距離は−10000〜10000 mmで指定してください');
 if(feature.kind!=='extrusion'||feature.profile!=='region'||feature.mode!=='solid'||feature.holesOnly)throw Error('OS押出は閉じたスケッチ領域またはソリッドの平面で使用してください');
}

// The immediate mesh is a display approximation; native offset wires are used
// by the CAD kernel before a feature can be committed.
export function offsetExtrusionRegions(region,distance){
 if(!Number.isFinite(distance)||Math.abs(distance)>10000)throw Error('OS距離を確認してください');
 if(!distance)return [structuredClone(region)];
 const scale=100000,path=(ring,outer)=>{const points=ring.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));if(Clipper.Clipper.Orientation(points)!==outer)points.reverse();return points;};
 const offset=new Clipper.ClipperOffset(4,.002*scale),tree=new Clipper.PolyTree();
 offset.AddPaths([path(region.outer,true),...region.holes.map(ring=>path(ring,false))],Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);
 offset.Execute(tree,distance*scale);const result=[];
 for(let node=tree.GetFirst();node;node=node.GetNext()){
  if(node.IsHole())continue;
  const outer=node.Contour().map(p=>[p.X/scale,p.Y/scale]),holes=node.Childs().filter(child=>child.IsHole()).map(child=>child.Contour().map(p=>[p.X/scale,p.Y/scale]));
  const area=(Math.abs(Clipper.Clipper.Area(node.Contour()))-node.Childs().filter(child=>child.IsHole()).reduce((sum,child)=>sum+Math.abs(Clipper.Clipper.Area(child.Contour())),0))/scale**2;
  if(area>1e-7)result.push({...region,id:region.id+':os:'+result.length,outer,holes,area});
 }
 if(!result.length)throw Error('このOS距離では押し出す領域がなくなります。距離を小さくしてください');
 return result;
}
