import {basisFor} from './frames.js';
import {regionContains} from './regions.js';
import {sketchSolidOverlapRegions} from './sketch-solid-overlap.js';
import Clipper from 'clipper-lib';

export const partitionLabel=region=>region?.partitionSide==='outside'?'ソリッドの外側の領域':'ソリッドと重なる領域';
function sharedArea(a,b){
 const paths=r=>[r.outer,...r.holes].map((ring,i)=>{const path=ring.map(([x,y])=>({X:Math.round(x*1e5),Y:Math.round(y*1e5)}));if(Clipper.Clipper.Orientation(path)!==(i===0))path.reverse();return path;});
 const clip=new Clipper.Clipper(),result=[];clip.AddPaths(paths(a),Clipper.PolyType.ptSubject,true);clip.AddPaths(paths(b),Clipper.PolyType.ptClip,true);clip.Execute(Clipper.ClipType.ctIntersection,result,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
 return Math.abs(result.reduce((s,p)=>s+Clipper.Clipper.Area(p),0))/1e10;
}

// Keep the selected side/component, rather than a tessellation-dependent ID.
// A disappearing or splitting component is an explicit, atomic edit failure.
export function refreshPartitionRegion(region,meshes){
 if(!region?.overlapSource)return region;
 const targets=region.overlapTargets||[],selected=meshes.filter(m=>targets.includes(m.userData.bodyId));
 if(!targets.length||targets.some(id=>!selected.some(m=>m.userData.bodyId===id)))throw Error('輪郭の参照先ボディが見つかりません。領域を選び直してください');
 const side=region.partitionSide||'inside',parts=sketchSolidOverlapRegions([region.overlapSource],selected,{includeOutside:true,includeUnsplit:true}).filter(p=>p.partitionSide===side);
 if(!parts.length)throw Error('選択した領域がなくなりました。領域を選び直してください');
 const continuing=parts.filter(p=>sharedArea(region,p)>Math.max(1e-5,region.area*1e-6));
 if(continuing.length>1)throw Error('選択した領域が複数に分かれました。領域を選び直してください');
 const b=basisFor(region.overlapSource),p=region.overlapPoint,local=p?[p.reduce((s,v,i)=>s+v*b.u.getComponent(i),0),p.reduce((s,v,i)=>s+v*b.v.getComponent(i),0)]:null;
 const matches=local?parts.filter(r=>regionContains(r,local)):[];
 const chosen=continuing.length===1?continuing[0]:matches.length===1?matches[0]:null;
 if(!chosen)throw Error('選択した領域を一意に追跡できません。領域を選び直してください');
 return {...chosen,id:region.id};
}
