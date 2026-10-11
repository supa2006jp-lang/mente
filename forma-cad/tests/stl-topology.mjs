export function binaryStlReport(data){
 const v=data instanceof DataView?data:new DataView(data.buffer??data,data.byteOffset??0,data.byteLength??data.byteLength);
 const count=v.getUint32(80,true),edges=new Map(),vertices=new Map();let degenerate=0,volume=0;
 const id=p=>{const key=p.join(',');if(!vertices.has(key))vertices.set(key,vertices.size);return vertices.get(key);};
 for(let i=0;i<count;i++){
  const p=Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>v.getFloat32(84+i*50+12+j*12+k*4,true))),ids=p.map(id),[a,b,c]=p;
  const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
  if(u[1]*w[2]-u[2]*w[1]===0&&u[2]*w[0]-u[0]*w[2]===0&&u[0]*w[1]-u[1]*w[0]===0)degenerate++;
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  for(let j=0;j<3;j++){const x=ids[j],y=ids[(j+1)%3],key=x<y?x+','+y:y+','+x,e=edges.get(key)||{count:0,sign:0};e.count++;e.sign+=x<y?1:-1;edges.set(key,e);}
 }
 return {triangles:count,degenerate,boundary:[...edges.values()].filter(e=>e.count===1).length,nonmanifold:[...edges.values()].filter(e=>e.count>2).length,orientation:[...edges.values()].filter(e=>e.count===2&&e.sign!==0).length,volume};
}
