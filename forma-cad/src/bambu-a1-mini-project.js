import preset from './bambu-a1-mini-preset.json' with {type:'json'};

export function bambuModelPlacement(parts,fit){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const {vertices} of parts)for(let i=0;i<vertices.length;i+=3){
  for(let k=0;k<3;k++){min[k]=Math.min(min[k],vertices[i+k]);max[k]=Math.max(max[k],vertices[i+k]);}
 }
 const span=max.map((v,k)=>v-min[k]);
 // Leave room at the edges of the 180 mm bed. Only the build instance scales.
 const scale=fit?Math.min(1,166/span[0],166/span[1],178/span[2]):1;
 const offset=[90-(min[0]+max[0])*scale/2,90-(min[1]+max[1])*scale/2,-min[2]*scale];
 return {scale,offset,size:span.map(n=>n*scale)};
}

// Factory A1 mini 0.4 mm, 0.16 mm Optimal and Generic PLA, as saved by Studio
// 02.04.00.70. Its per-filament options have one entry per logical colour;
// machine arrays (nozzles, axes, build area) keep their original lengths.
export function bambuA1MiniProject(swatches){
 const count=swatches.length;
 if(count>32)throw Error('Bambu Studioの面の色分けは32色までです。色数を減らすか「3MF（色付き）」で保存してください。');
 const project={...preset.project};
 for(const [key,value] of Object.entries(preset.filament))project[key]=Array(count).fill(value);
 for(const key of ['inherits_group','different_settings_to_system']){
  const [process,filament,machine]=preset.project[key];
  project[key]=[process,...Array(count).fill(filament),machine];
 }
 project.filament_colour=swatches;
 project.default_filament_colour=swatches;
 project.filament_self_index=swatches.map((_,i)=>String(i+1));
 const [unload,load]=preset.project.flush_volumes_vector;
 project.flush_volumes_vector=swatches.flatMap(()=>[unload,load]);
 const purge=preset.project.flush_volumes_matrix[1];
 project.flush_volumes_matrix=swatches.flatMap((_,i)=>swatches.map((__,j)=>i===j?'0':purge));
 return project;
}
