import {basisFor} from './frames.js';

// Measure the added tool, never the complete joined body or source outline.
export function measureUnextrudedDimensions(feature,outputs){
 const basis=basisFor(feature.region||feature),axes=[basis.u.toArray(),basis.v.toArray(),basis.n.toArray()],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 let count=0;
 for(const output of outputs||[]){const vertices=output.vertices||[];
  for(let i=0;i+2<vertices.length;i+=3){if(!Number.isFinite(vertices[i]+vertices[i+1]+vertices[i+2]))return null;
   for(let axis=0;axis<3;axis++){const a=axes[axis],value=vertices[i]*a[0]+vertices[i+1]*a[1]+vertices[i+2]*a[2];min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}count++;
  }
 }
 return count?{width:max[0]-min[0],depth:max[1]-min[1],height:max[2]-min[2]}:null;
}
export function formatUnextrudedDimensions(rows){
 const number=value=>String(Number(value.toFixed(3)));
 return rows.slice(0,3).map((row,index)=>(rows.length>1?'追加部分 '+(index+1):'追加部分')+'：幅 '+number(row.width)+' × 奥行 '+number(row.depth)+' × 高さ '+number(row.height)+' mm').join('\n')+(rows.length>3?'\nほか '+(rows.length-3)+' 領域':'');
}
