import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,makeGeometry,rebuild,volume} from '../src/geometry.js';
for(const operation of ['cut','join'])test(`CAD操作後のボディに押し出し ${operation}`,()=>{
 const g=makeGeometry({...defaults,width:30,height:30,depth:20});
 const vertices=Array.from(g.attributes.position.array),triangles=Array.from({length:vertices.length/3},(_,i)=>i);
 const base={kind:'cadop',id:'op',name:'移動／回転',remove:[],outputs:[{id:'body',vertices,triangles}]};
 const feature={...defaults,id:'extrude',name:'押し出し',operation,target:'body',width:10,height:10,depth:30,z:-5};
 const bodies=rebuild([base,feature]);assert.ok(Math.abs(volume(bodies.get('body').geometry)-(operation==='cut'?16000:19000))<.1);
 const next=rebuild([base,feature,{...feature,id:'second',operation:'cut',x:10,width:5}]);assert.ok(Number.isFinite(volume(next.get('body').geometry)));for(const b of bodies.values())b.geometry.dispose();for(const b of next.values())b.geometry.dispose();g.dispose();
});
