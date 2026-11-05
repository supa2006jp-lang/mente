import {evaluateDimensionExpression,normalizeDimensionExpression} from './dimension-expression.js';

const namePattern=/^[\p{L}_][\p{L}\p{N}_]{0,31}$/u;
export function readNamedDimensions(data){
 if(data!=null&&(typeof data!=='object'||Array.isArray(data)))throw Error('名前付き寸法のデータが不正です');
 const entries=Object.entries(data||{});
 if(entries.length>64)throw Error('名前付き寸法は64個まで登録できます');
 const values=Object.create(null);
 for(const [name,value] of entries){
  if(!namePattern.test(name))throw Error('寸法名は文字または _ で始め、32文字以内にしてください');
  if(!Number.isFinite(value)||Math.abs(value)>10000)throw Error('寸法「'+name+'」は -10000〜10000 mm で指定してください');
  values[name]=value;
 }
 return values;
}

export function namedDimensionBinding(expression,values){
 const normalized=normalizeDimensionExpression(expression).trim();
 const names=new Set();
 const result=evaluateDimensionExpression(normalized,values,name=>names.add(name));
 return names.size?{expression:normalized,names:[...names],value:Number(result.toPrecision(15))}:null;
}

export function extrusionHasFixedDepth(feature){
 return feature.kind==='extrusion'&&!feature.gridExtentPlane&&!feature.endPlane&&!feature.untilSolid&&!feature.throughAll;
}

export function linkedDimensionFields(feature){
 const fields=[],add=(key,data=feature,min=.1,signed=false)=>fields.push({key,data,min,max:10000,signed});
 if(extrusionHasFixedDepth(feature))add('depth',feature,.1,!feature.symmetric);
 if(['sketch','extrusion'].includes(feature.kind)&&!feature.region){
  if(feature.profile==='rect'){add('width');add('height');}
  if(feature.profile==='circle')add('diameter');
  if(feature.profile==='line')add('width');
 }
 if(feature.hole&&feature.counterbore){add('counterboreDiameter');add('counterboreDepth');}
 if(feature.kind==='cadop'&&feature.spec?.type==='fillet')add('radius',feature.spec,.000001);
 if(feature.kind==='cadop'&&feature.spec?.type==='shell')add('thickness',feature.spec,.000001);
 if(feature.kind==='cadop'&&feature.spec?.type==='join'&&feature.spec.combineMode==='切り取り'){
  fields.push({key:'cutClearance',data:feature.spec,min:0,max:1000});
 }
 return fields;
}
export const linkedDimensionField=feature=>linkedDimensionFields(feature)[0]||null;

export function planNamedDimensionChange(features,before,after){
 let start=features.length;
 const next=features.map((feature,index)=>{
  let updated=feature;
  for(const field of linkedDimensionFields(feature)){
   const expression=feature.dimensionLinks?.[field.key];
   if(typeof expression!=='string')continue;
   const binding=namedDimensionBinding(expression,before);
   if(!binding?.names.some(name=>before[name]!==after[name]))continue;
   const value=namedDimensionBinding(expression,after).value,measure=field.signed?Math.abs(value):value;
   if(measure<field.min||measure>field.max)throw Error('「'+feature.name+'」の寸法が範囲外です');
   if(value===field.data[field.key])continue;
   start=Math.min(start,index);
   updated=field.data===feature?{...updated,[field.key]:value}:{...updated,spec:{...updated.spec,[field.key]:value}};
  }
  return updated;
 });
 return {next,start};
}
