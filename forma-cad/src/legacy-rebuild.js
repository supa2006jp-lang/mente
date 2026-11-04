import {cadPosition} from './cad-coordinates.js';
const displayOnly=new Set(['name','historyGroup','groupId','groupNumber','groupHidden','textOutline','solidBoundaryLink','offsetLink']);
const shapeStep=f=>Object.fromEntries(Object.entries(f).filter(([key])=>!displayOnly.has(key)));
// Track each live body's actual display dependencies. Appending sketches or
// editing a different CAD body must not invalidate a legacy body's geometry.
export function legacyBodyStates(features){
 const states=new Map();
 for(const f of features){
  const cad=f.cadResult||(f.kind==='cadop'?f:null);
  if(cad){for(const id of cad.remove||[])states.delete(id);for(const output of cad.outputs||[])states.set(output.id,{legacy:false,steps:[{kind:'cadop',id:f.id,outputs:[output],remove:[]}]});continue;}
  if(['sketch','plane','referenceImage'].includes(f.kind))continue;
  if(f.operation==='new')states.set(f.id,{legacy:false,steps:[shapeStep(f)]});
  else{const previous=states.get(f.target);if(previous)states.set(f.target,{legacy:true,steps:[...previous.steps,shapeStep(f)]});}
 }
 for(const [id,state] of states)if(state.legacy)state.key=JSON.stringify([id,state.steps]);
 return states;
}
export function rebuiltBodyRecord(id,body){
 const geometry=body.geometry,position=cadPosition(geometry),normal=geometry.attributes.normal;
 return {id,vertices:Array.from(position.array),triangles:geometry.index?Array.from(geometry.index.array):Array.from({length:position.count},(_,i)=>i),...(normal?{normals:Array.from(normal.array)}:{}),...(geometry.userData.faceGroups?{faceGroups:structuredClone(geometry.userData.faceGroups)}:{}),...(geometry.userData.planarFaces?{planarFaces:[...geometry.userData.planarFaces]}:{}),cadCoordinatePrecision:geometry.userData.cadCoordinatePrecision===true};
}
export class LegacyDisplayCache{
 constructor({maxBytes=96*1024*1024}={}){this.maxBytes=maxBytes;this.rows=new Map();this.bytes=0;}
 missing(features){return [...legacyBodyStates(features).values()].filter(s=>s.legacy&&!this.rows.has(s.key));}
 store(records){for(const row of records){const bytes=row.output.vertices.length*8+row.output.triangles.length*4+(row.output.normals?.length||0)*4+row.key.length*2,old=this.rows.get(row.key);if(old)this.bytes-=old.bytes;this.rows.delete(row.key);this.rows.set(row.key,{output:row.output,bytes});this.bytes+=bytes;}while(this.bytes>this.maxBytes&&this.rows.size>1){const key=this.rows.keys().next().value;this.bytes-=this.rows.get(key).bytes;this.rows.delete(key);}}
 augmented(features){const outputs=[];for(const state of legacyBodyStates(features).values())if(state.legacy){const row=this.rows.get(state.key);if(!row)throw Object.assign(Error('旧形式の表示を背景で再構築する必要があります。操作をやり直してください。'),{code:'background-rebuild-required'});this.rows.delete(state.key);this.rows.set(state.key,row);outputs.push(row.output);}return outputs.length?[...features,{kind:'cadop',id:'background-display-only',outputs,remove:[]}]:features;}
}
