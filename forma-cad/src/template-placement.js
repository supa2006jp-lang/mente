// Use conservative body bounds so newly inserted parts also avoid hidden bodies.
export function templatePlacement(bounds,occupied,gap=5){
 const valid=b=>Array.isArray(b?.min)&&Array.isArray(b?.max)&&b.min.length===3&&b.max.length===3&&b.min.every((v,i)=>Number.isFinite(v)&&Number.isFinite(b.max[i])&&v<=b.max[i]);
 if(!valid(bounds)||!Array.isArray(occupied)||occupied.some(b=>!valid(b)))throw Error('配置するボディの範囲が不正です');
 const overlaps=(offset,b)=>[0,1,2].every(i=>bounds.min[i]+offset[i]<b.max[i]+gap&&bounds.max[i]+offset[i]>b.min[i]-gap);
 const free=offset=>!occupied.some(b=>overlaps(offset,b));if(free([0,0,0]))return [0,0,0];
 const candidates=[];for(const b of occupied){candidates.push([b.max[0]+gap-bounds.min[0],0,0],[b.min[0]-gap-bounds.max[0],0,0],[0,b.max[1]+gap-bounds.min[1],0],[0,b.min[1]-gap-bounds.max[1],0]);}
 candidates.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));const result=candidates.find(free);if(!result)throw Error('部品を配置する空き位置が見つかりません');return result;
}
export function vertexBounds(vertices){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<vertices.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],vertices[i]);max[axis]=Math.max(max[axis],vertices[i]);}return {min,max};}
