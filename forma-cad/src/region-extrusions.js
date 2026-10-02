export function regionExtrusions(template,regions,join=false){
 const batch=regions.map((r,i)=>({...template,id:crypto.randomUUID(),name:template.name+' '+(i+1),region:structuredClone(r),plane:r.plane,frame:r.frame,x:r.plane==='YZ'?r.offset:0,y:r.plane==='XZ'?r.offset:0,z:r.plane==='XY'?r.offset:0}));
 if(join&&template.operation==='new')for(const f of batch.slice(1)){f.operation='join';f.target=batch[0].id;}
 return batch;
}
