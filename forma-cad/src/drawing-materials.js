export const drawingMaterialsKey='forma-cad-drawing-materials-v1';
export const standardDrawingMaterials=[
 ['ステンレス鋼',['SUS304','SUS316','SUS430']],
 ['鋼',['SS400','SPCC','S45C']],
 ['アルミニウム',['A5052','A6061','A7075']],
 ['銅・黄銅',['C1100','C3604']],
 ['樹脂',['ABS','PLA','PETG','PA','PC','POM','TPU']],
];
export const drawingMaterialKey=value=>value.trim().normalize('NFKC').toUpperCase();
const standard=new Set(standardDrawingMaterials.flatMap(([,materials])=>materials));
const maxMaterials=50;
export function canSaveDrawingMaterial(value){
 const label=value.trim();
 return !!label&&label.length<=80&&!/[\x00-\x1f\x7f]/.test(label)&&!standard.has(drawingMaterialKey(label));
}
export function createDrawingMaterialsStore({storage=()=>globalThis.localStorage}={}){
 function load(){
  const raw=storage().getItem(drawingMaterialsKey);
  if(raw===null)return [];
  let values;
  try{if(raw.length<=8192)values=JSON.parse(raw);}catch{}
  if(!Array.isArray(values)||values.length>maxMaterials||
   values.some(value=>typeof value!=='string'||value!==value.trim()||!canSaveDrawingMaterial(value))||
   new Set(values.map(drawingMaterialKey)).size!==values.length)throw Error('登録した材質を読み込めません');
  return values;
 }
 function write(values){
  storage().setItem(drawingMaterialsKey,JSON.stringify(values));
  return values;
 }
 return {
  load,
  save(value){
   value=value.trim();
   if(!canSaveDrawingMaterial(value))throw Error('材質名を1〜80文字で入力してください');
   const values=load(),key=drawingMaterialKey(value);
   if(values.some(item=>drawingMaterialKey(item)===key))return values;
   if(values.length>=maxMaterials)throw Error('材質は50件まで登録できます');
   return write([...values,value]);
  },
  remove(value){return write(load().filter(item=>drawingMaterialKey(item)!==drawingMaterialKey(value)));},
 };
}
