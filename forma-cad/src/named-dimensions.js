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

export function linkedDimensionField(feature){
 if(extrusionHasFixedDepth(feature))return {key:'depth',data:feature,min:.1,max:10000,signed:!feature.symmetric};
 if(feature.kind==='cadop'&&feature.spec?.type==='shell')return {key:'thickness',data:feature.spec,min:.000001,max:10000};
 if(feature.kind==='cadop'&&feature.spec?.type==='join'&&feature.spec.combineMode==='切り取り'){
  return {key:'cutClearance',data:feature.spec,min:0,max:1000};
 }
 return null;
}

export function planNamedDimensionChange(features,before,after){
 let start=features.length;
 const next=features.map((feature,index)=>{
  const field=linkedDimensionField(feature);
  const expression=field&&feature.dimensionLinks?.[field.key];
  if(typeof expression!=='string')return feature;
  const binding=namedDimensionBinding(expression,before);
  if(!binding?.names.some(name=>before[name]!==after[name]))return feature;
  const value=namedDimensionBinding(expression,after).value;
  const measure=field.signed?Math.abs(value):value;
  if(measure<field.min||measure>field.max)throw Error('「'+feature.name+'」の寸法が範囲外です');
  if(value===field.data[field.key])return feature;
  start=Math.min(start,index);
  const values={...field.data,[field.key]:value};
  return field.data===feature?values:{...feature,spec:values};
 });
 return {next,start};
}
