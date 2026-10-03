import * as THREE from 'three';
// Local XZ coordinates match GridHelper, so all existing work-plane transforms apply.
export function cadGrid(step,divisions=100,labels=true,labelOffset=[0,0]){
 const extent=step*divisions/2,positions=[],colors=[],quads=[],major=step*5,width=step*.012;
 const append=(a,b,color)=>{positions.push(...a,...b);colors.push(...color.toArray(),...color.toArray());};
 for(let i=-divisions/2;i<=divisions/2;i++){
  const v=i*step,color=new THREE.Color(i%5===0?0xbfc1c4:0xe6e7e9);
  append([-extent,0,v],[extent,0,v],color);append([v,0,-extent],[v,0,extent],color);
  if(i%5===0&&i!==0){for(const swap of [false,true]){const pts=[[-extent,v-width],[extent,v-width],[extent,v+width],[-extent,v-width],[extent,v+width],[-extent,v+width]];for(const [x,z] of pts)quads.push(...(swap?[z,0,x]:[x,0,z]));}}
 }
 const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3)),new THREE.LineBasicMaterial({vertexColors:true}));
 grid.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(quads,3)),new THREE.MeshBasicMaterial({color:0xbfc1c4,side:THREE.DoubleSide,depthWrite:false})));
 if(labels)for(let v=-extent;v<=extent;v+=major){for(const axis of [0,1]){
  const value=v+labelOffset[axis],cross=step*(axis?.4:.3)-labelOffset[axis?0:1];if(!value||Math.abs(cross)>extent)continue;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#666b73';ctx.font='40px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(value),128,32);
  const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(step*.9,step*.225,1);sprite.position.set(axis?cross:v,.02,axis?v:cross);grid.add(sprite);
 }}
 return grid;
}
