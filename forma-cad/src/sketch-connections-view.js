import * as THREE from 'three';
import {sketchConnections} from './sketch-connections.js';

function material(connected){return new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,uniforms:{size:{value:connected?9:10},pixelRatio:{value:1},color:{value:new THREE.Color(connected?0x00865a:0xc46906)},filled:{value:connected?1:0}},vertexShader:'uniform float size;uniform float pixelRatio;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z-=0.0000001*gl_Position.w;gl_PointSize=size*pixelRatio;}',fragmentShader:'uniform vec3 color;uniform float filled;void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;float alpha=1.0-smoothstep(0.85,1.0,d);if(filled<0.5)alpha*=smoothstep(0.40,0.56,d);if(alpha<0.02)discard;vec3 ink=mix(color,vec3(1.0),smoothstep(0.65,0.85,d));gl_FragColor=vec4(ink,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'.replace(';#include',';\n#include')});}
export function createSketchConnectionsView({scene,host,getFeatures,getObjects,isVisible}){
 const group=new THREE.Group();group.name='sketch-connections';scene.add(group);
 const style=document.createElement('style');style.textContent='#sketch-connections-control[hidden],#sketch-connections-legend[hidden]{display:none!important}';document.head.append(style);
 const label=document.createElement('label');label.id='sketch-connections-control';label.title='端点の接続状態を表示します。塗り丸＝接続、輪＝未接続。交差するだけの線・別スケッチ・補助線は接続に数えません。';label.innerHTML='<input id="sketch-connections-toggle" type="checkbox" checked> 接続点';document.getElementById('snap-controls').append(label);
 const legend=document.createElement('small');legend.id='sketch-connections-legend';legend.style.cssText='display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-size:12px';legend.innerHTML='<span style="color:#007c52">● 接続 <b data-connected></b></span><span style="color:#a95000">○ 未接続 <b data-open></b></span>';label.after(legend);
 const toggle=label.querySelector('input');let history=null,signature=null,nodes=[],state='',displayed=false;
 function clear(){for(const object of [...group.children]){object.geometry.dispose();object.material.dispose();group.remove(object);}}
 function rebuild(visible){
  clear();nodes=sketchConnections(getFeatures().filter(f=>visible.has(f.id)));
  for(const connected of [true,false]){const points=nodes.filter(n=>n.connected===connected).map(n=>n.point);if(!points.length)continue;const object=new THREE.Points(new THREE.BufferGeometry().setFromPoints(points),material(connected));object.raycast=()=>{};object.renderOrder=9;object.onBeforeRender=renderer=>{object.material.uniforms.pixelRatio.value=renderer.getPixelRatio();};group.add(object);}
  legend.querySelector('[data-connected]').textContent=String(nodes.filter(n=>n.connected).length);legend.querySelector('[data-open]').textContent=String(nodes.filter(n=>!n.connected).length);
  state=JSON.stringify({connected:nodes.filter(n=>n.connected).length,open:nodes.filter(n=>!n.connected).length,points:nodes.map(n=>({point:n.point.toArray(),connected:n.connected,degree:n.degree,featureIds:n.featureIds}))});
 }
 function update(){
  const available=isVisible();label.hidden=!getFeatures().some(f=>f.kind==='sketch'&&!f.groupHidden);group.visible=available&&toggle.checked&&!label.hidden;legend.hidden=!group.visible||label.hidden;
  if(!group.visible){if(displayed)delete host.dataset.sketchConnections;displayed=false;return;}
  const visible=new Set(getObjects().filter(o=>o.visible&&o.material?.visible!==false).map(o=>o.userData.featureId)),key=[...visible].sort().join('|');
  if(history!==getFeatures()||signature!==key){history=getFeatures();signature=key;rebuild(visible);displayed=false;}
  legend.hidden=!nodes.length;if(!displayed)host.dataset.sketchConnections=state;displayed=true;
 }
 toggle.onchange=update;
 return {update,group,dispose(){clear();group.removeFromParent();label.remove();legend.remove();style.remove();delete host.dataset.sketchConnections;}};
}
