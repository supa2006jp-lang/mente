import {indexedPrintSupportMesh} from './print-support-3mf-mesh.js';
export function inspectPrintSupportPackage(pkg,{targetId,supportId}={}){
 if(!pkg)return {ok:false,state:'unavailable',parts:[],issues:[{role:'configuration',message:'3MF用のプレビューを作成してください'}]};
 const parts=[],issues=[],bodies=Array.isArray(pkg.bodies)?pkg.bodies:[],blockers=Array.isArray(pkg.blockers)?pkg.blockers:[];
 if(!pkg.complete)issues.push({role:'configuration',message:'支えの配置を見直してください'});
 if(!Array.isArray(pkg.bodies)||!pkg.bodies.length||!Array.isArray(pkg.blockers)||!pkg.blockers.length)issues.push({role:'configuration',message:'本体・サポート・除外範囲が揃っていません'});
 if(!Number.isFinite(pkg.layerHeight)||pkg.layerHeight<.06||pkg.layerHeight>.4)issues.push({role:'configuration',message:'積層ピッチが不正です'});
 for(const [index,mesh]of bodies.entries())parts.push({id:mesh?.id,index,role:mesh?.id===supportId?'support':mesh?.id===targetId?'target':'base',mesh});
 for(const [index,mesh]of blockers.entries())parts.push({index,role:'blocker',mesh});
 const rows=parts.map(({mesh,...part})=>{try{const indexed=indexedPrintSupportMesh(mesh);return {...part,ok:true,triangles:indexed.triangles.length/3};}catch(error){const issue={...part,ok:false,message:error.message};issues.push(issue);return issue;}});
 return {ok:!issues.length,state:issues.length?'blocked':'ready',parts:rows,issues};
}
export function supportExportPartName(part,bodyName=id=>id){
 return part.role==='target'?'本体：'+bodyName(part.id):part.role==='base'?'土台：'+bodyName(part.id):part.role==='support'?'連結リブサポート':part.role==='blocker'?'自動サポート除外範囲 '+(part.index+1):'配置・設定';
}
