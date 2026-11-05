import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {build} from 'esbuild';
const bundle=(await build({stdin:{contents:
"export * as THREE from 'three'; export * from './src/body-face-paint.js'; export * from './src/body-appearance.js'; export * from './src/body-paint-render.js';",
resolveDir:process.cwd()},bundle:true,write:false,format:'esm'})).outputFiles[0].text;
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 try{
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html>');return;}
  res.setHeader('Content-Type','text/javascript');res.end(bundle);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const {THREE,facePaintReference,prepareBodyPaint,applyBodyMeshPaint,syncBodyPaintRender}=await import('/regression.js');
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);
  scene.background=new THREE.Color('white');
  scene.add(new THREE.AmbientLight('white',2));
  camera.position.z=5;
  const renderer=new THREE.WebGLRenderer();renderer.setSize(128,128);
  renderer.localClippingEnabled=true;
  const target=new THREE.WebGLRenderTarget(128,128);renderer.setRenderTarget(target);
  const vertices=[],normal=[];
  function quad(x,y,u,v,z){vertices.push(x,y,z,u,y,z,u,v,z,x,y,z,u,v,z,x,v,z);for(let i=0;i<6;i++)normal.push(0,0,1);}
  quad(-1.8,-1.8,0,1.8,1);quad(0,-1.8,1.8,1.8,1);
  quad(-1.8,-1.8,1.8,0,0);
  const source=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
   .setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
  const geometry=prepareBodyPaint(source,[{...facePaintReference(source,[{start:0,count:6}]),color:'#aa33aa'}]);
  const style={color:'transparent:#00cc00',customColor:true};
  const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(applyBodyMeshPaint(geometry,style)));
  scene.add(body);
  const edge=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.8,1,0),new THREE.Vector3(1.8,1,0)]),
   new THREE.LineBasicMaterial({color:'#ff0000',transparent:true,opacity:.9}));
  edge.renderOrder=4;
  body.add(edge);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),new THREE.MeshBasicMaterial({color:'#00ccff',transparent:true,opacity:.4,depthWrite:false}));
  glass.position.set(-1,1.4,1.3);glass.renderOrder=3;scene.add(glass);
  function sample(x,y){const p=new Uint8Array(4);renderer.readRenderTargetPixels(target,x,y,1,1,p);return Array.from(p);}
  function read(){
   renderer.render(scene,camera);
   const row=Array.from({length:5},(_,i)=>[sample(32,94+i),sample(96,94+i)]);
   return {purple:sample(32,88),rearFace:sample(32,52),leftEdge:row.map(p=>p[0]),rightEdge:row.map(p=>p[1]),
    right:sample(96,88),front:sample(32,109)};
  }
  const before=read();
  const pass=syncBodyPaintRender(body);
  const after=read();
  body.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,0,-1),.5)];
  const clipped=read();
  body.material.clippingPlanes=null;
  body.material.opacity=.24;
  const faded=read();
  body.material.opacity=1;
  const restored=read();
  body.material.setValues(applyBodyMeshPaint(geometry,{color:'#00cc00',customColor:true}));
  syncBodyPaintRender(body);
  const solid=read();
  return {before,after,clipped,faded,restored,solid,passIsOpaque:pass.transparent===false,baseRestored:body.material.depthFunc===THREE.LessEqualDepth};
 });
 const {before,after,clipped,faded,restored,solid,passIsOpaque,baseRestored}=result;
 assert.ok(passIsOpaque&&baseRestored);
 assert.notDeepEqual(before.rearFace,before.purple);
 assert.ok(before.leftEdge.some(p=>p[0]>after.purple[0]+50));
 assert.deepEqual(after.rearFace,after.purple);
 assert.ok(after.leftEdge.every(p=>JSON.stringify(p)===JSON.stringify(after.purple)));
 assert.ok(after.rightEdge.some(p=>p[0]>after.right[0]+20&&p[1]<after.right[1]-20));
 assert.ok(after.front[1]>after.purple[1]+20);
 assert.notDeepEqual(clipped.purple,after.purple);
 assert.notDeepEqual(faded.purple,after.purple);
 assert.deepEqual(restored,after);
 assert.ok(solid.purple.every((value,i)=>Math.abs(value-after.purple[i])<=2));
 console.log('PASS opaque face occludes rear facets and edges, keeps front glass, respects clipping and temporary transparency');
}finally{await browser?.close();server.close();}
