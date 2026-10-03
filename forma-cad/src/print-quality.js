import {analyzeCoilPrint} from './coil-print-check.js';
export async function analyzePrintQuality(outputs,{nozzle=.6,shouldCancel}={}){
 if(!Number.isFinite(nozzle)||nozzle<.1||nozzle>2)throw Error('ノズル径は0.1〜2 mmで指定してください');
 const warning=await analyzeCoilPrint(outputs,{minThickness:nozzle*2,checkOverhang:false,shouldCancel});
 const critical=await analyzeCoilPrint(outputs,{minThickness:nozzle,checkOverhang:false,shouldCancel});
 const result={nozzle,warningThickness:nozzle*2,criticalTriangles:critical.stats.thinTriangles,warningTriangles:warning.stats.thinTriangles-critical.stats.thinTriangles,triangles:warning.stats.triangles,outputs:[]};
 for(const entry of warning.outputs){const red=critical.outputs.find(item=>item.id===entry.id).thin,keys=new Set();for(let i=0;i<red.length;i+=9)keys.add(red.slice(i,i+9).join(','));const yellow=[];for(let i=0;i<entry.thin.length;i+=9){const triangle=entry.thin.slice(i,i+9);if(!keys.has(triangle.join(',')))yellow.push(...triangle);}result.outputs.push({id:entry.id,yellow,red});}
 return result;
}
