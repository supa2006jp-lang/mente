import {Box3, Vector3} from 'three';
import {createMeshDistance} from './stl-surface-distance.js';
import {MeshoptSimplifier} from 'three/addons/libs/meshopt_simplifier.module.js';
import {analyzeStl, compactStl, reducePlanarStl} from './stl-import-mesh.js';

function measuredDeviation(a,b,maxDeviation) {
 const distance = createMeshDistance(b.points.flatMap(p => p.toArray()),b.triangles.flat());
 try {
  const point = new Vector3();
  let max = 0;
  const measure = () => {
   max = Math.max(max,distance.at(point,maxDeviation+1e-8));
  };
  for (const p of a.points) {
   point.copy(p);
   measure();
   if (max > maxDeviation) return max;
  }
  // Mid-edge and interior samples also detect changes hidden by surviving vertices.
  const step = Math.max(1,Math.floor(a.triangles.length/12000));
  for (let i=0; i<a.triangles.length; i+=step) {
   const [x,y,z] = a.triangles[i].map(id => a.points[id]);
   point.copy(x).add(y).add(z).multiplyScalar(1/3); measure();
   point.copy(x).lerp(y,.5); measure();
   point.copy(y).lerp(z,.5); measure();
   point.copy(z).lerp(x,.5); measure();
   if (max > maxDeviation) return max;
  }
  return max;
 } finally {distance.dispose();}
}

function shapeSignature(analysis) {
 return analysis.shells?.map(shell => {
  const vertices = new Set();
  for (const face of shell.faces) for (const vertex of analysis.solidFaces[face]) vertices.add(vertex);
  return shell.depth+':'+(vertices.size-shell.faces.length/2);
 }).sort().join(',');
}

export async function simplifyStl(part,analysis,{percentage,maxDeviation}) {
 if (!analysis.shells || !Number.isFinite(percentage) || percentage < 5 || percentage > 95 ||
     !Number.isFinite(maxDeviation) || maxDeviation < .001 || maxDeviation > 5) {
  throw Error('残す割合は5〜95%、許容するずれは0.001〜5 mmで指定してください');
 }
 const faces = analysis.solidFaces.slice();
 for (const shell of analysis.shells) {
  if ((shell.volume < 0) === (shell.depth%2===1)) continue;
  for (const i of shell.faces) {
   const [a,b,c] = faces[i];
   faces[i] = [a,c,b];
  }
 }
 const source = compactStl(part.points,faces);
 const center = new Box3().setFromPoints(source.points).getCenter(new Vector3());
 const positions = Float32Array.from(source.points.flatMap(p => p.clone().sub(center).toArray()));
 const indices = Uint32Array.from(source.triangles.flat());
 const target = Math.max(12,Math.floor(source.triangles.length*percentage/100)*3);
 await MeshoptSimplifier.ready;
 let reason = '指定した許容差では三角形を減らせませんでした';
 const attempts = [
  () => {
   const [result] = MeshoptSimplifier.simplify(indices,positions,3,target,maxDeviation,['ErrorAbsolute']);
   if (result.length >= indices.length) return null;
   const triangles = [];
   for (let i=0;i<result.length;i+=3) triangles.push([result[i],result[i+1],result[i+2]]);
   return compactStl(source.points,triangles);
  },
  () => reducePlanarStl(source)
 ];
 const signature = shapeSignature(analysis);
 for (const attempt of attempts) {
  const simplified = attempt();
  if (!simplified) continue;
  const check = analyzeStl(simplified);
  if (!check.shells || check.repair || shapeSignature(check) !== signature) {
   reason = '簡略化で面の接続や空洞の構成が変わりました。残す割合を増やしてください';
   continue;
  }
  const deviation = Math.max(measuredDeviation(source,simplified,maxDeviation),
   measuredDeviation(simplified,source,maxDeviation));
  if (deviation <= maxDeviation) {
   return {simplified,analysis:check,deviation,before:source.triangles.length,after:simplified.triangles.length};
  }
  reason = '測定したずれが指定値を超えました。残す割合を増やしてください';
 }
 throw Error(reason);
}
