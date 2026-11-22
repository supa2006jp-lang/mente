import {featureReads,featureWrites} from './history-impact.js';
import {machiningSuppressed} from './machining-suppression.js';
import {allExtrusionTargets,multipleExtrusionTargets} from './extrusion-targets.js';
import {validateProject} from './geometry.js';
import {linkedDimensionFields,namedDimensionBinding,readNamedDimensions} from './named-dimensions.js';
import {sketchConstraintsEnabled} from './sketch-constraints.js';

const editableOperations=new Set(['join','shell','fillet','chamfer','split','move','sphere','revolve','loft','pipe','simpleBoss','freeScrew']);
const modelFeature=feature=>feature.kind==='extrusion'||!feature.kind;

function bodyChanges(feature){
 if(machiningSuppressed(feature))return {outputs:[...featureWrites(feature)],remove:[]};
 const result=feature.cadResult??(feature.kind==='cadop'?feature:null);
 if(result)return {outputs:result.outputs.map(o=>o.id),remove:result.remove};
 if(!modelFeature(feature))return {outputs:[],remove:[]};
 return {outputs:feature.operation==='new'?[feature.id]:feature.targetBodies??[feature.target],remove:[]};
}

function checkHistoryOperation(feature){
 const op=feature.spec;
 const supported=feature.kind==='sketch'? !feature.solidBoundaryLink&&!feature.offsetLink&&!feature.textSurface:
  feature.kind==='plane'?true:
  modelFeature(feature)? !allExtrusionTargets(feature)&&!feature.barrier&&!feature.untilSolid&&!feature.overlapOnly&&
   !feature.faceBatch&&!feature.region?.overlapSource&&(!multipleExtrusionTargets(feature)||!!feature.cadResult):
  feature.kind==='cadop'&&(!op||editableOperations.has(op.type))&&
   (op?.type!=='move'||!op.copy&&op.moveMode!=='複製して移動'&&!op.contactMove)&&
   (op?.type!=='split'||!op.sectionSplit);
 if(!supported)throw Error('「'+feature.name+'」は編集履歴付きの部品保存に対応していません。完成形状として保存できます。');
}

export function selectionHistoryBodyIds(features){
 const ids=new Set();
 for(const feature of features){
  const {outputs,remove}=bodyChanges(feature);
  remove.forEach(id=>ids.delete(id));
  outputs.forEach(id=>ids.add(id));
 }
 return ids;
}

function requiredHistory(features,targets){
 const known=new Map(features.map((feature,index)=>[feature.id,index])),groups=new Map(),live=new Map(),before=[];
 for(const [index,feature] of features.entries()){
  before.push(new Map(live));
  const {outputs,remove}=bodyChanges(feature);
  remove.forEach(id=>live.delete(id));
  outputs.forEach(id=>live.set(id,index));
  if(feature.kind==='sketch'&&feature.groupId){
   if(!groups.has(feature.groupId))groups.set(feature.groupId,[]);
   groups.get(feature.groupId).push(index);
  }
 }
 const selected=new Set(),pending=targets.map(id=>{
  if(!live.has(id))throw Error('保存するソリッドの作成工程が見つかりません');
  return live.get(id);
 });
 while(pending.length){
  const index=pending.pop();
  if(selected.has(index))continue;
  const feature=features[index],earlier=before[index];
  checkHistoryOperation(feature);
  selected.add(index);
  const read=featureReads(feature);
  const {outputs,remove}=bodyChanges(feature);
  for(const id of [...outputs,...remove])if(earlier.has(id))read.add(id);
  if(feature.kind==='sketch'){
   pending.push(...(groups.get(feature.groupId)??[]));
   for(const constraint of feature.sketchConstraints??[]){
    for(const reference of [constraint.first,constraint.second,constraint.axis])if(reference?.featureId)read.add(reference.featureId);
   }
   if(feature.openingSketch?.sketchId)read.add(feature.openingSketch.sketchId);
  }
  for(const id of read){
   if(!id)continue;
   const featureIndex=known.get(id);
   const parent=earlier.get(id)??(['sketch','plane'].includes(features[featureIndex]?.kind)?featureIndex:undefined);
   if(parent===undefined||parent>=index&&features[parent].kind!=='sketch')throw Error('「'+feature.name+'」の参照先を部品に含められません');
   pending.push(parent);
  }
 }
 return features.filter((_,index)=>selected.has(index));
}

const meshFields=['id','brep','vertices','triangles','normals','faceGroups','planarFaces','cadCoordinatePrecision',
 'shapeMetrics','materialParts','faceMaterials'];
function savedResult(result,keepThreadSource=false){
 return {outputs:result.outputs.map(o=>{
  if(!o.brep)throw Error('編集履歴のソリッドにCAD形状データがありません');
  const mesh=Object.fromEntries(meshFields.filter(key=>o[key]!==undefined).map(key=>[key,o[key]]));
  return keepThreadSource&&o.threadSource?{...mesh,threadSource:o.threadSource}:mesh;
 }),remove:result.remove};
}

function savedFeature(feature){
 if(feature.kind==='cadop'){
  const {outputs,remove,analysis,removed,added,previewWarnings,...input}=feature;
  return {...input,...savedResult(feature,feature.spec?.type==='freeScrew')};
 }
 return feature.cadResult?{...feature,cadResult:savedResult(feature.cadResult)}:feature;
}

function historyDimensions(features,values){
 const named=readNamedDimensions(values),used=new Set();
 for(const feature of features)for(const {key} of linkedDimensionFields(feature)){
  const expression=feature.dimensionLinks?.[key];
  if(typeof expression==='string')for(const name of namedDimensionBinding(expression,named)?.names??[])used.add(name);
 }
 return Object.fromEntries([...used].map(name=>[name,named[name]]));
}

export function captureSelectionHistory(features,targets,namedDimensions){
 const relevant=requiredHistory(features,targets);
 if(!relevant.some(f=>modelFeature(f)||f.spec)){
  throw Error('この部品には編集できる作成工程がありません。完成形状として保存できます。');
 }
 const enabled=sketchConstraintsEnabled(features);
 const saved=relevant.map(feature=>{
  const saved=savedFeature(feature);
  if(enabled||feature.kind!=='sketch')return saved;
  // Preserve the geometry of sketches saved with constraints switched off,
  // including when pasting them into a document that has constraints enabled.
  return {...saved,sketchConstraintsEnabled:false,
   ...(saved.sketchConstraints?{sketchConstraints:saved.sketchConstraints.map(constraint=>({...constraint,enabled:false}))}:{})};
 });
 validateProject({format:'forma-cad',version:1,features:saved});
 return {features:saved,targets:[...targets],namedDimensions:historyDimensions(relevant,namedDimensions)};
}

export function readSelectionHistory(value,count){
 if(!value||!Array.isArray(value.features)||!value.features.length||value.features.length>=150||
  value.features.some(feature=>!feature||typeof feature!=='object'||Array.isArray(feature))||
  !Array.isArray(value.targets)||value.targets.length!==count||!count||
  new Set(value.targets).size!==count||value.targets.some(id=>typeof id!=='string'||!id.length||id.length>100)){
  throw Error('部品の編集履歴データが不正です');
 }
 return {features:value.features,targets:value.targets,namedDimensions:historyDimensions(value.features,value.namedDimensions)};
}

const ids=new Set(['id','target','other','bodyId','featureId','groupId','sketchId','gridSourceBodyId','path','sourceBody','pinTarget','lidTarget']);
const idLists=new Set(['targets','others','targetBodies','sourceIds','sourceSketchIds','cutTargets','overlapTargets','barrierBodies','remove']);
function remapReferences(value,map,key){
 if(typeof value==='string')return ids.has(key)?map.get(value)??value:value;
 if(Array.isArray(value)){
  if(idLists.has(key))return value.map(id=>map.get(id)??id);
  return value.length&&typeof value[0]==='object'?value.map(item=>remapReferences(item,map)):value;
 }
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,remapReferences(item,map,key)]));
 return value;
}

function allocateDimensions(saved,existing){
 const values={...readNamedDimensions(existing)},map=new Map();
 for(const [source,value] of Object.entries(saved)){
  let name=source;
  for(let n=2;Object.hasOwn(values,name);n++){
   const suffix='_'+n;
   name=[...source].slice(0,32-suffix.length).join('')+suffix;
  }
  Object.defineProperty(values,name,{value,enumerable:true});
  map.set(source,name);
 }
 return {values:readNamedDimensions(values),map};
}

function remapExpressions(feature,names){
 if(!feature.dimensionLinks)return feature;
 // Consume numbers including their exponent as a single token.
 const token=/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[\p{L}_][\p{L}\p{N}_]*/gu;
 return {...feature,dimensionLinks:Object.fromEntries(Object.entries(feature.dimensionLinks).map(([key,expression])=>
  [key,typeof expression==='string'?expression.replace(token,part=>names.get(part)??part):expression]))};
}

export function placeSelectionHistory(history,namespace,existing,name){
 const source=validateProject({format:'forma-cad',version:1,features:history.features});
 if(requiredHistory(source,history.targets).length!==source.length)throw Error('選択部品に関係しない工程が含まれています');
 const map=new Map(),add=id=>{
  if(typeof id==='string'&&id&&!map.has(id))map.set(id,namespace+'-'+map.size.toString(36));
 };
 for(const feature of source){
  add(feature.id);add(feature.spec?.id);add(feature.groupId);
  for(const constraint of feature.sketchConstraints??[])add(constraint.id);
  bodyChanges(feature).outputs.forEach(add);
 }
 const {values,map:names}=allocateDimensions(history.namedDimensions,existing);
 const group=name.slice(0,60);
 const features=source.map(feature=>{
  const copied=remapExpressions(remapReferences(savedFeature(feature),map),names);
  return {...copied,historyGroup:group,...(feature.kind==='sketch'?{groupHidden:true}:{})};
 });
 historyDimensions(features,values);
 const targets=history.targets.map(id=>map.get(id));
 const bodies=selectionHistoryBodyIds(features);
 return {features,targets,discard:[...bodies].filter(id=>!targets.includes(id)),namedDimensions:values};
}

export function selectionTemplateFeatureCount(data){
 if(!data.history)return data.sketches.length+data.solids.length;
 const count=data.history.features.length,bodyIds=selectionHistoryBodyIds(data.history.features);
 return count+data.sketches.length+1+Number(bodyIds.size>data.history.targets.length);
}
