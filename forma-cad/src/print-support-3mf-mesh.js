import {inspectStlMesh} from './stl-mesh-health.js';

// 3MF edges share vertex indices, unlike STL's independent triangles. Merge
// identical positions only, per part. Never bridge a gap with a distance tolerance.
export function indexedPrintSupportMesh(mesh){
 const v=mesh?.vertices,t=mesh?.triangles;
 if(!Array.isArray(v)||!Array.isArray(t)||!v.length||v.length%3||!t.length||t.length%3)throw Error('3MFの形状データが不完全です');
 if(t.length/3>400000)throw Error('3MFの三角形数が検査の上限を超えています');
 const vertices=[],triangles=[],map=new Int32Array(v.length/3),ids=new Map(),edges=new Map();
 for(let i=0;i<v.length;i+=3){
  const point=v.slice(i,i+3);if(!point.every(n=>Number.isFinite(n)&&Number.isFinite(Math.fround(n))))throw Error('3MFの頂点座標が不正です');
  const key=point.join(',');let id=ids.get(key);if(id===undefined){id=vertices.length/3;ids.set(key,id);vertices.push(...point);}map[i/3]=id;
 }
 for(let i=0;i<t.length;i+=3){
  const indices=t.slice(i,i+3);if(!indices.every(n=>Number.isInteger(n)&&n>=0&&n<map.length))throw Error('3MFの三角形の参照先が不正です');
  const [a,b,c]=indices.map(n=>map[n]),p=[a,b,c].map(n=>vertices.slice(n*3,n*3+3)),u=p[1].map((n,k)=>n-p[0][k]),w=p[2].map((n,k)=>n-p[0][k]);
  if(u[1]*w[2]-u[2]*w[1]===0&&u[2]*w[0]-u[0]*w[2]===0&&u[0]*w[1]-u[1]*w[0]===0)continue;
  triangles.push(a,b,c);
  for(const [x,y]of [[a,b],[b,c],[c,a]]){const key=Math.min(x,y)+','+Math.max(x,y);let edge=edges.get(key);if(!edge){edge={count:0,sign:0};edges.set(key,edge);}edge.count++;edge.sign+=x<y?1:-1;}
 }
 if(!triangles.length||[...edges.values()].some(e=>e.count!==2||e.sign!==0))throw Error('3MFの面の接続に問題があるため出力を中止しました。形状を確認してください');
 const audit=inspectStlMesh({vertices,triangles});
 if(!audit.ok||audit.removedDegenerate)throw Error('3MFの形状をスライサーの精度で確認できません。形状を確認してください');
 return {vertices,triangles};
}
