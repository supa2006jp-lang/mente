// STL stores independent Float32 triangles. CAD tessellation can leave a
// collapsed triangle at a spherical pole, even when the BREP is a valid solid.
// Remove only exactly zero-area facets; preserve all printable geometry bytes.
export function cleanBinaryStl(data){
 let view;
 if(data instanceof DataView)view=data;
 else if(data instanceof ArrayBuffer)view=new DataView(data);
 else if(ArrayBuffer.isView(data))view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 else throw Error('STLの出力データを確認できません');
 if(view.byteLength<84)throw Error('STLの出力データが不完全です');
 const count=view.getUint32(80,true);
 if(view.byteLength!==84+count*50)throw Error('STLの三角形データが不完全です');
 const keep=[];
 for(let i=0;i<count;i++){
  const offset=84+i*50+12,p=[];
  for(let j=0;j<9;j++){
   const value=view.getFloat32(offset+j*4,true);
   if(!Number.isFinite(value))throw Error('STLに不正な頂点座標があります');
   p.push(value);
  }
  const ux=p[3]-p[0],uy=p[4]-p[1],uz=p[5]-p[2];
  const vx=p[6]-p[0],vy=p[7]-p[1],vz=p[8]-p[2];
  if(uy*vz-uz*vy===0&&uz*vx-ux*vz===0&&ux*vy-uy*vx===0)continue;
  keep.push(i);
 }
 if(!keep.length)throw Error('STLに出力できる面がありません');
 if(keep.length===count)return data;
 const bytes=new Uint8Array(84+keep.length*50);
 bytes.set(new Uint8Array(view.buffer,view.byteOffset,84));
 for(let i=0;i<keep.length;i++)bytes.set(new Uint8Array(view.buffer,view.byteOffset+84+keep[i]*50,50),84+i*50);
 const result=new DataView(bytes.buffer);result.setUint32(80,keep.length,true);
 return result;
}
