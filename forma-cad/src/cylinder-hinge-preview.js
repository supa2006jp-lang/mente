import * as THREE from 'three';

// Center the plate around the assembly without moving either captive component.
export function hingePlate(bounds,materials){
 const group=new THREE.Group();group.name='cylinder-hinge-plate';
 const cx=(bounds.min[0]+bounds.max[0])/2,cy=(bounds.min[1]+bounds.max[1])/2,half=bounds.plateSize/2;
 const min=new THREE.Vector2(cx-half,cy-half),max=new THREE.Vector2(cx+half,cy+half);
 for(const material of materials){
  material.onBeforeCompile=shader=>{
   shader.uniforms.hingePlateMin={value:min};shader.uniforms.hingePlateMax={value:max};
   shader.vertexShader='varying vec2 hingePlateXY;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhingePlateXY=(modelMatrix*vec4(position,1.0)).xy;');
   shader.fragmentShader='varying vec2 hingePlateXY;\nuniform vec2 hingePlateMin;\nuniform vec2 hingePlateMax;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(any(lessThan(hingePlateXY,hingePlateMin))||any(greaterThan(hingePlateXY,hingePlateMax)))diffuseColor.rgb=vec3(1.0,0.08,0.04);');
  };
  material.customProgramCacheKey=()=> 'cylinder-hinge-plate-mask-v1';material.needsUpdate=true;
 }
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(bounds.plateSize,bounds.plateSize),new THREE.MeshBasicMaterial({color:0x55c5d5,opacity:.12,transparent:true,depthWrite:false,side:THREE.DoubleSide}));plane.position.set(cx,cy,-.06);group.add(plane);
 const corners=[[min.x,min.y],[max.x,min.y],[max.x,max.y],[min.x,max.y],[min.x,min.y]].map(([x,y])=>new THREE.Vector3(x,y,-.03));
 group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:bounds.fits?0x0084a6:0xff4433})));
 return group;
}

export function holderSection(a){
 if(!a.fitHolder)return '';
 const inner=a.innerRadius,lip=a.lipInset,depth=Math.min(a.height,Math.max(8,a.lipHeight+3)),scale=Math.min(150/depth,180/(a.wall+lip+a.holderGap+2)),top=50,bottom=top+depth*scale,seat=top+(a.holderLip?a.lipHeight:0)*scale;
 const right=470,wall=a.wall*scale,ledge=lip*scale,holderRight=right-wall-a.holderGap*scale;
 const rect=(x,y,w,h,color)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'"/>';
 let svg='<svg viewBox="0 0 520 260" role="img" aria-label="ホルダーの外径と筒の内径、上端の掛かり段差の断面" style="width:100%;background:#10212c;border-radius:6px"><text x="260" y="24" fill="#dce6ef" text-anchor="middle" font-size="16">上端の断面（片側を拡大）</text>';
 svg+=rect(right-wall,top,wall,bottom-top,'#6cafd2');
 if(a.holderLip)svg+=rect(right-wall-ledge,top,ledge,a.lipHeight*scale,'#6cafd2');
 svg+='<rect x="'+50+'" y="'+seat+'" width="'+(holderRight-50)+'" height="'+(bottom-seat)+'" fill="#8ee5b81a" stroke="#8ee5b8" stroke-width="2" stroke-dasharray="6 4"/>';
 svg+='<text x="260" y="'+(Math.min(bottom-10,seat+36))+'" fill="#8ee5b8" text-anchor="middle" font-size="15">ホルダー外形 Ø'+a.holderDiameter.toFixed(2)+' mm</text>';
 svg+='<text x="260" y="226" fill="#9ed7f2" text-anchor="middle" font-size="15">筒の内径 Ø'+(inner*2).toFixed(2)+' mm ／ 片側すき間 '+a.holderGap.toFixed(2)+' mm</text>';
 svg+='<text x="260" y="250" fill="#dce6ef" text-anchor="middle" font-size="13">'+(a.holderLip?'縁への掛かり '+a.holderOverlap.toFixed(2)+' mm ／ 縁の高さ '+a.holderSeatHeight.toFixed(2)+' mm':'掛かり段差なし')+'</text></svg>';
 return svg;
}
