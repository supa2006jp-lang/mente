import * as R from 'replicad';
import {Box3} from 'three';
import {serializeCadShape} from './cad-serialization.js';
import {verifiedCadMesh} from './verified-cad-mesh.js';
import {analyzeStl, readStl, splitStlParts, stlPartsIntersect, STL_SOLID_MAX_TRIANGLES} from './stl-import-mesh.js';
import {circularStlProfile} from './stl-import-round.js';
import {simplifyStl} from './stl-import-simplify.js';
import {reviewStlConversion} from './stl-import-review.js';
import {fuseSolids} from './solid-fuse.js';

function makeSolid(shell, triangles, points) {
 const faces = [];
 try {
  for (const i of shell.faces) faces.push(R.makePolygon(triangles[i].map(id => points[id].toArray())));
  return R.makeSolid(faces);
 } finally {faces.forEach(face => face.delete());}
}

function withCavities(outer, cavities) {
 const oc = R.getOC(), builder = new oc.BRepBuilderAPI_MakeSolid(outer.wrapped);
 try {
  for (const cavity of cavities) {
   const explorer = new oc.TopExp_Explorer(cavity.wrapped, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
   try {
    if (!explorer.More()) throw Error('内側の空洞を確認できませんでした');
    const item = explorer.Current();
    let shell;
    try {
     shell = oc.TopoDS.Shell(item);
     explorer.Next();
     if (explorer.More()) throw Error('空洞の境界が複数に分かれています');
     shell.Reverse();
     builder.Add(shell);
    } finally {shell?.delete(); item.delete();}
   } finally {explorer.delete();}
  }
  return new R.Solid(builder.Solid());
 } finally {builder.delete();}
}

function valid(solid, volume) {
 const check = new (R.getOC().BRepCheck_Analyzer)(solid.wrapped, true, false);
 try {
  return check.IsValid() && Math.abs(R.measureVolume(solid) - volume) <= Math.max(1e-8, volume * 1e-7);
 } finally {check.delete();}
}

function buildOutput(shell, children, faces, points, id) {
 const expectedVolume = Math.abs(shell.volume) - children.reduce((sum, child) => sum + Math.abs(child.volume), 0);
 let outer, result, simplified;
 const cavities = [];
 try {
  outer = makeSolid(shell,faces,points);
  for (const child of children) cavities.push(makeSolid(child,faces,points));
  result = cavities.length ? withCavities(outer,cavities) : outer;
  if (!(expectedVolume > 0) || !valid(result,expectedVolume)) throw Error('再構築したソリッドを形状検査で確認できませんでした');
  // Join coplanar CAD faces when safe so flat faces can be edited as one.
  try {
   simplified = result.simplify();
   if (!valid(simplified,expectedVolume)) {
    simplified.delete();
    simplified = null;
   }
  } catch {simplified?.delete(); simplified = null;}
  const shape = simplified || result;
  return outputShape(shape,id);
 } finally {
  simplified?.delete();
  if (result !== outer) result?.delete();
  outer?.delete();
  cavities.forEach(cavity => cavity.delete());
 }
}

function outputShape(shape,id) {
 const mesh = verifiedCadMesh(shape), cadFaces = shape.faces;
 try {
  return {id,...mesh,cadCoordinatePrecision:true,planarFaces:cadFaces.filter(face => face.geomType === 'PLANE').map(face => face.hashCode),brep:serializeCadShape(shape)};
 } finally {cadFaces.forEach(face => face.delete());}
}

function circularPrism({axis,height,loops},selected,own) {
 const wires = loops.map((loop,i) => {
  if (selected.has(loop.circle?.id)) {
   const normal = i ? axis.map(x => -x) : axis;
   return own(R.assembleWire([own(R.makeCircle(loop.circle.radius,loop.circle.center,normal))]));
  }
  return own(own(R.makePolygon(loop.points)).outerWire());
 });
 const cap = own(R.makeFace(wires[0]));
 const face = wires.length > 1 ? own(R.addHolesInFace(cap,wires.slice(1))) : cap;
 const solid = own(R.basicFaceExtrusion(face,own(new R.Vector(axis.map(n => n*height)))));
 const volume = height * loops.reduce((sum,loop,i) => {
  const area = selected.has(loop.circle?.id) ? Math.PI*loop.circle.radius**2 : loop.area;
  return sum+(i?-area:area);
 },0);
 if (!(volume>0) || !valid(solid,volume)) throw Error('復元した円形の境界が近接・交差しています。復元する候補を減らしてください');
 return {solid,volume};
}

function buildCircularOutput(profile,selected,id) {
 const owned = [];
 const own = object => {owned.push(object); return object;};
 try {
  const pieces = profile.slabs.map(slab=>circularPrism(slab,selected,own));
  const solid = pieces.length===1 ? pieces[0].solid : own(fuseSolids(pieces.map(piece=>piece.solid)));
  const volume = pieces.reduce((sum,piece)=>sum+piece.volume,0);
  const connected = solid.solids;
  connected.forEach(shape=>shape.delete());
  if (connected.length!==1 || !valid(solid,volume)) throw Error('段の接続を確認できません。復元する候補を減らしてください');
  return outputShape(solid,id);
 } finally {owned.reverse().forEach(object => object.delete());}
}

export function inspectStlImport(spec, onProgress) {
 onProgress?.({stage:'STLを部品ごとに分けています…'});
 const parts = splitStlParts(readStl(spec.data)).map((source,i) => {
  onProgress?.({stage:'部品の面と輪郭を検査しています…',current:i+1});
  const analysis = analyzeStl(source,{quick:true,listRepairs:true});
  const profile = analysis.shells && circularStlProfile({points:source.points,...analysis});
  return {id:i+1,source,analysis,profile,simplification:null};
 });
 const preview = parts.map(({id,source,analysis,profile}) => ({
  id, triangles:source.triangles.length, mesh:analysis.mesh, counts:analysis.counts,
  segments:analysis.segments, segmentsTruncated:analysis.segmentsTruncated,
  repairs:analysis.repairs, unfilled:analysis.unfilled, message:analysis.message,
  circles:profile?.circles || []
 }));
 return {id:spec.id,parts,preview:{parts:preview,maxTriangles:STL_SOLID_MAX_TRIANGLES}};
}

function sessionPart(session,id) {
 const part = session?.parts.find(part => part.id === id);
 if (!part) throw Error('STLの部品情報が見つかりません。ファイルを読み直してください');
 return part;
}

export async function simplifyStlImport(session,spec,onProgress) {
 const part = sessionPart(session,spec.part);
 onProgress?.({stage:'三角形を減らし、元の表面とのずれを測定しています…'});
 const candidate = await simplifyStl(part.source,part.analysis,spec);
 part.simplification = {...candidate,id:spec.id};
 return {id:spec.id,mesh:candidate.analysis.mesh,before:candidate.before,after:candidate.after,deviation:candidate.deviation};
}

export function convertStlImport(session,spec,onProgress) {
 if (!session || session.id !== spec.session || !Array.isArray(spec.parts) || !spec.parts.length) {
  throw Error('変換するSTLの部品を選んでください');
 }
 const used = new Set(), prepared = [];
 let total = 0, facets = 0;
 for (const options of spec.parts) {
  const part = sessionPart(session,options.part);
  if (used.has(part.id)) throw Error('同じ部品は一度だけ選択できます');
  used.add(part.id);
  const prefix = '部品 '+part.id+' ／ ';
  if (!part.analysis.shells) throw Error(prefix+(part.analysis.message || 'ソリッドに変換できません'));
  if (part.analysis.repairs.some(repair => !options.repairs?.includes(repair.id))) {
   throw Error(prefix+'修正候補を採用するか、部品の選択を外してください');
  }
  const circles = new Set(options.circles || []);
  const simplification = options.simplification && part.simplification;
  if ((options.simplification && simplification?.id !== options.simplification) ||
      (circles.size && (simplification || [...circles].some(id => !part.profile?.circles.some(circle => circle.id === id))))) {
   throw Error(prefix+'変換候補の情報が変わりました。設定を確認してください');
  }
  const triangleCount = simplification?.after ?? part.analysis.solidFaces.length;
  if (!circles.size && triangleCount > STL_SOLID_MAX_TRIANGLES) throw Error(prefix+'2万三角形を超えています。簡略化してから変換してください');
  if (circles.size && part.profile.slabs.flatMap(slab=>slab.loops).reduce((sum,loop) => sum+(circles.has(loop.circle?.id)?1:loop.points.length),0) > STL_SOLID_MAX_TRIANGLES) {
   throw Error(prefix+'輪郭が複雑です。簡略化してから変換してください');
  }
  const count = part.analysis.shells.filter(shell => shell.depth%2===0).length;
  total += count;
  if (!circles.size) facets += triangleCount;
  prepared.push({part,circles,simplification});
 }
 if (total > Math.min(100,spec.maxBodies ?? 100)) throw Error('工程に追加できるボディ数を超えています。選択を減らしてください');
 if (facets > 40_000) throw Error('選択した部品は合計4万三角形を超えています。何回かに分けて変換してください');
 const checked = [];
 for (const {part,circles,simplification} of prepared) {
  onProgress?.({stage:'選択した部品の面の接続を確認しています…'});
  const analysis = simplification?.analysis || analyzeStl(part.source);
  if (!analysis.shells) throw Error('部品 '+part.id+' ／ '+(analysis.message || '面の接続を確認できませんでした'));
  const points = simplification?.simplified.points || part.source.points;
  const box = new Box3();
  for (const shell of analysis.shells) box.union(shell.box);
  const current = {part,circles,points,faces:analysis.solidFaces,shells:analysis.shells,box};
  for (const other of checked) {
   if (stlPartsIntersect(other,current)) throw Error('部品 '+other.part.id+' と部品 '+part.id+' の面が交差しています。片方の選択を外してください');
  }
  checked.push(current);
 }
 const outputs = [], reviewParts = [];
 for (const [i,{part,circles,points,faces,shells}] of checked.entries()) {
  onProgress?.({stage:'選択した部品をCADソリッドに変換しています…',current:i+1,total:checked.length});
  try {
   const start = outputs.length;
   if (circles.size) outputs.push(buildCircularOutput(part.profile,circles,spec.id+'-'+outputs.length));
   else for (const shell of shells.filter(shell => shell.depth%2===0)) {
    outputs.push(buildOutput(shell,shells.filter(other => other.parent===shell),faces,points,spec.id+'-'+outputs.length));
   }
   if (spec.review) reviewParts.push({id:part.id,source:part.analysis.mesh,outputs:outputs.slice(start)});
  } catch (error) {
   console.warn('STLの部品を変換できませんでした',error);
   const message = /[\u3040-\u9fff]/.test(error?.message || '') ? error.message : '閉じたCADソリッドを作れませんでした。極小の面や交差する面を確認してください';
   throw Error('部品 '+part.id+' ／ '+message);
  }
 }
 return {outputs,...(spec.review?{reviews:reviewStlConversion(reviewParts,onProgress)}:{})};
}
