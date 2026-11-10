import {BufferAttribute,BufferGeometry,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

export function createMeshDistance(vertices,triangles) {
 const origin = new Vector3().fromArray(vertices), geometry = new BufferGeometry();
 const relative = Float64Array.from(vertices,(value,i) => value-origin.getComponent(i%3));
 geometry.setAttribute('position',new BufferAttribute(relative,3));
 geometry.setIndex(new BufferAttribute(Uint32Array.from(triangles),1));
 let tree;
 try {tree = new MeshBVH(geometry);}
 catch (error) {geometry.dispose(); throw error;}
 const local = new Vector3(), hit = {};
 return {
  at(point,limit=Infinity) {return tree.closestPointToPoint(local.copy(point).sub(origin),hit,0,limit)?.distance ?? Infinity;},
  dispose() {geometry.dispose();}
 };
}

// The colour of each triangle represents the largest of its measured distances.
export function measureStlSurface(source,target) {
 const distance = createMeshDistance(target.vertices,target.triangles);
 const {vertices,triangles} = source, values = new Float32Array(triangles.length/3);
 const verticesMeasured = new Float64Array(vertices.length/3).fill(-1);
 const point = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3();
 let maximum = 0, location = null;
 try {
  const record = value => {
   if (value > maximum) {maximum = value; location = point.toArray();}
   return value;
  };
  for (let i=0;i<triangles.length;i+=3) {
   const x=triangles[i], y=triangles[i+1], z=triangles[i+2];
   a.fromArray(vertices,x*3); b.fromArray(vertices,y*3); c.fromArray(vertices,z*3);
   let largest = 0;
   for (const id of [x,y,z]) {
    if (verticesMeasured[id] < 0) verticesMeasured[id] = record(distance.at(point.fromArray(vertices,id*3)));
    largest = Math.max(largest,verticesMeasured[id]);
   }
   const measure = () => {largest = Math.max(largest,record(distance.at(point)));};
   point.copy(a).add(b).add(c).divideScalar(3); measure();
   // On very large meshes the centroid and vertices already give dense coverage.
   if (values.length <= 60_000) {
    point.copy(a).lerp(b,.5); measure();
    point.copy(b).lerp(c,.5); measure();
    point.copy(c).lerp(a,.5); measure();
   }
   values[i/3] = largest;
  }
  return {values,maximum,location};
 } finally {distance.dispose();}
}
