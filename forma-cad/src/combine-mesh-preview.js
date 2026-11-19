import {Evaluator,ADDITION,INTERSECTION} from 'three-bvh-csg';
import {meshCsgBrush,meshCsgData} from './mesh-csg-data.js';

// Preview-only booleans run in a terminable worker. History and photos stay out.
export function combinePreviewMeshes(target,tools){
 return [target,...tools].map(meshCsgData);
}
export function meshCombinePreview({bodies}){
 if(!Array.isArray(bodies)||bodies.length<2)throw Error('対象とツールを選択してください');
 const evaluator=new Evaluator(),geometries=new Set(),brushes=[];evaluator.useGroups=false;evaluator.attributes=['position','normal'];
 const brush=value=>{
  const b=meshCsgBrush(value);geometries.add(b.geometry);brushes.push(b);return b;
 };
 try{
  const base=brush(bodies[0]);let tool=brush(bodies[1]);
  for(const value of bodies.slice(2)){tool=evaluator.evaluate(tool,brush(value),ADDITION);geometries.add(tool.geometry);brushes.push(tool);tool.updateMatrixWorld(true);}
  const result=evaluator.evaluate(base,tool,INTERSECTION);geometries.add(result.geometry);brushes.push(result);
  return {positions:result.geometry.attributes.position.array.slice(),indices:result.geometry.index?.array.slice()||null,matrix:result.matrix.toArray()};
 }finally{for(const g of geometries)g.dispose();for(const b of brushes)for(const m of Array.isArray(b.material)?b.material:[b.material])m?.dispose();}
}
