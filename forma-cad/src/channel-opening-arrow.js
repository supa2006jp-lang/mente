import {channelOpeningMarker} from './channel-sketch.js';
export function createChannelOpeningArrow({host,project}){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.id='channel-opening-arrow';svg.hidden=true;svg.setAttribute('role','img');svg.setAttribute('aria-label','コの字の開口方向');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;overflow:hidden';
 const halo=document.createElementNS(ns,'path'),path=document.createElementNS(ns,'path'),label=document.createElementNS(ns,'text');for(const [node,width,color] of [[halo,7,'white'],[path,3,'#9546bf']]){node.setAttribute('fill','none');node.setAttribute('stroke',color);node.setAttribute('stroke-width',width);node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');}label.textContent='開口';label.setAttribute('fill','#74339b');label.setAttribute('stroke','white');label.setAttribute('stroke-width',3);label.setAttribute('paint-order','stroke');label.setAttribute('text-anchor','middle');label.setAttribute('dominant-baseline','middle');label.style.font='bold 12px sans-serif';svg.append(halo,path,label);host.append(svg);
 function hide(){svg.style.display='none';svg.hidden=true;delete host.dataset.channelOpeningArrow;}
 function update(feature){
  const marker=feature&&channelOpeningMarker(feature);if(!marker){hide();return;}
  const p=project(marker.point),q=project(marker.point.clone().add(marker.direction)),length=Math.hypot(q.x-p.x,q.y-p.y);if(!Number.isFinite(length)||length<.1||p.z< -1||p.z>1||p.x<0||p.y<0||p.x>host.clientWidth||p.y>host.clientHeight){hide();return;}
  const dx=(q.x-p.x)/length,dy=(q.y-p.y)/length,a={x:p.x+dx*10,y:p.y+dy*10},end={x:p.x+dx*39,y:p.y+dy*39},d=`M${a.x},${a.y}L${end.x},${end.y}m${-dx*9-dy*6},${-dy*9+dx*6}L${end.x},${end.y}l${-dx*9+dy*6},${-dy*9-dx*6}`;halo.setAttribute('d',d);path.setAttribute('d',d);label.setAttribute('x',p.x+dx*56);label.setAttribute('y',p.y+dy*56);svg.hidden=false;svg.style.display='block';host.dataset.channelOpeningArrow=JSON.stringify({point:marker.point.toArray(),direction:marker.direction.toArray(),screen:[p.x,p.y],end:[end.x,end.y]});
 }
 hide();return {update,hide};
}
