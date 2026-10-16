// Resolve the entire selection before changing UI state: curved faces must not
// silently disappear from a multi-face extrusion.
export function faceExtrusionRegions(entries,resolve=entry=>entry.plane){
 const regions=entries.map(entry=>{const plane=resolve(entry);if(!plane?.outer?.length)throw Error('押し出しは平面を選択してください。曲面はプレス／プルを使用できます');return {...structuredClone(plane),id:plane.id||entry.key||'face-'+crypto.randomUUID(),bodyId:entry.bodyId};});
 return regions;
}

export function regionExtrusions(template,regions,join=false){
 const batch=regions.map((r,i)=>({...template,id:crypto.randomUUID(),name:template.name+' '+(i+1),region:structuredClone(r),...(r.overlapSource?{overlapOnly:template.mode!=='thin',overlapTargets:[...r.overlapTargets]}:{}),plane:r.plane,frame:r.frame,x:r.plane==='YZ'?r.offset:0,y:r.plane==='XZ'?r.offset:0,z:r.plane==='XY'?r.offset:0}));
 // Each solid face uses its outline at command entry. Earlier members must
 // not enlarge a neighbouring face before that face's tool is constructed.
 if(regions.length>1&&regions.every(r=>r.bodyId||r.cadFace?.bodyId))for(const feature of batch)feature.faceBatch=batch[0].id;
 if(join&&template.operation==='new')for(const f of batch.slice(1)){f.operation='join';f.target=batch[0].id;}
 return batch;
}
