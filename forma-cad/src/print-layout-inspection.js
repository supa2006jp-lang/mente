import {Vector3} from 'three';
import {cadPosition} from './cad-coordinates.js';
import {analyzeCoilPrint} from './coil-print-check.js';
import {analyzePrintPreflight} from './print-preflight.js';
import {printPlacementMatrix} from './print-layout.js';

const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const triangleLimit=300000;
export async function inspectPrintLayoutPlate(plate,geometries,{shouldCancel}={}){
 const sources=plate.placements.map(placement=>({placement,geometry:geometries.get(placement.id)}));
 if(sources.some(({geometry})=>!geometry))throw Error('印刷チェック用の形状を取得できません');
 const triangleCount=sources.reduce((count,{geometry})=>count+(geometry.index?.count??cadPosition(geometry).count)/3,0);
 if(triangleCount>triangleLimit)return {incomplete:true};
 const outputs=[],point=new Vector3();
 for(const {placement,geometry} of sources){
  const position=cadPosition(geometry),matrix=printPlacementMatrix(placement);
  const vertices=[],triangles=[],count=geometry.index?.count??position.count;
  for(let i=0;i<position.count;i++){
   if(i%20000===0){await pause();if(shouldCancel?.())return null;}
   point.fromBufferAttribute(position,i).applyMatrix4(matrix);
   vertices.push(point.x,point.y,point.z);
  }
  for(let i=0;i<count;i++)triangles.push(geometry.index?.getX(i)??i);
  outputs.push({id:placement.id,vertices,triangles});
 }
 const preflight=await analyzePrintPreflight(outputs,{floatingOnly:true,shouldCancel});
 const overhang=await analyzeCoilPrint(outputs,{checkThickness:false,overhangAngle:45,shouldCancel});
 return {floating:preflight.issues.filter(issue=>issue.type==='floating'),overhang:overhang.outputs.filter(output=>output.unsupported.length)};
}

export function printWarningSummary(report){
 if(report.incomplete)return '未実施（三角形30万枚超）';
 if(report.error)return '確認できませんでした';
 return '浮き '+report.floating.length+' 箇所 ／ オーバーハング '+report.overhang.length+' ボディ';
}

export async function comparePrintOrientations(candidates,geometry,current,{shouldCancel,onProgress}={}){
 const rows=[],a=new Vector3(),b=new Vector3(),c=new Vector3();
 for(const [i,candidate] of candidates.entries()){
  if(shouldCancel?.())return null;
  onProgress?.(i+1,candidates.length);
  if(!candidate.placement){rows.push(candidate);continue;}
  const {placement}=candidate;
  const report=await inspectPrintLayoutPlate({placements:[placement]},new Map([[placement.id,geometry]]),{shouldCancel});
  if(!report||shouldCancel?.())return null;
  let area=0;
  for(const {unsupported} of report.overhang??[])for(let j=0;j<unsupported.length;j+=9){
   a.fromArray(unsupported,j);b.fromArray(unsupported,j+3).sub(a);c.fromArray(unsupported,j+6).sub(a);
   area+=b.cross(c).length()/2;
  }
  rows.push({...candidate,incomplete:report.incomplete,floating:report.floating?.length,area});
 }
 const ranked=rows.filter(row=>row.placement&&!row.incomplete).sort((a,b)=>
  a.floating-b.floating||(Math.abs(a.area-b.area)>.01?a.area-b.area:Number(b.orientation===current)-Number(a.orientation===current)));
 return {rows,recommended:ranked[0]?.orientation};
}
