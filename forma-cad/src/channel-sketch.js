import {planeCoordinates} from './regions.js';

// Store ordinary, connected sketch lines with an open end; no wall or face.
export function channelSketch(feature,opening='left'){
 const w=feature.width/2,h=feature.height/2,corners=[[-w,-h],[w,-h],[w,h],[-w,h]],start={left:0,down:1,right:2,up:3}[opening];
 if(start===undefined)throw Error('コの字の開く向きを選択してください');
 const o=planeCoordinates(feature),a=feature.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=Array.from({length:4},(_,i)=>{const [x,y]=corners[(start+i)%4];return [o.u+x*c-y*s,o.v+x*s+y*c];});
 return {...feature,profile:'polyline',closed:false,points};
}
