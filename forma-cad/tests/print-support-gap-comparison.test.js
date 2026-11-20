import assert from 'node:assert/strict';
import test from 'node:test';
import {compareSupportGap} from '../src/print-support-gap-comparison.js';

const rectangle=(width,height=6)=>({
 vertices:[0,0,20,width,0,20,width,height,20,0,height,20],
 triangles:[0,1,2,0,2,3],
});
const rib=(id,center,ceilingId='auto:1')=>({id,ceilingId,axis:0,center,bounds:[[center-.4,0,0],[center+.4,6,20]]});
const band=(start,end,from=0,to=6)=>({start,end,from,to,width:end-start});
function entry({ribs,skin,bands,sideGap}){
 const coverage=[{ceilingId:'auto:1',face:rectangle(20),skinSupport:{face:skin},
  bridges:{axis:0,bands,max:Math.max(...bands.map(item=>item.width)),unbraced:0}}];
 return {input:{sideGap,wallPitch:6,lineWidth:.4},result:{supportPreview:{ribs,coverage}}};
}

test('side-gap comparison locates replaced support on the same ceiling and clips the lost skin',()=>{
 const before=entry({ribs:[rib('left',2),rib('missing',8),rib('right',14),rib('island',8,'auto:2')],
  skin:rectangle(20),bands:[band(2,8),band(8,14),band(14,20)],sideGap:.5});
 const after=entry({ribs:[rib('left-shifted',2.3),rib('right-shifted',14.3),rib('island',8,'auto:2')],
  skin:rectangle(16),bands:[band(2.3,14.3),band(14.3,20)],sideGap:.8});
 const result=compareSupportGap(before,after);
 assert.deepEqual(result.removed.map(item=>item.id),['missing']);
 assert.equal(result.beforeCount,4);
 assert.equal(result.afterCount,3);
 assert.equal(result.skins.length,1);
 assert.equal(result.skins[0].area,24);
 assert(result.skins[0].vertices.filter((_,i)=>i%3===0).every(x=>x>=16));
 assert.equal(result.spans.length,1);
 assert.deepEqual(result.spans[0].widest,{before:6,after:12,growth:6});
});

test('retriangulating an unchanged thin skin or shifting a rib slightly adds no false changes',()=>{
 const skin=rectangle(20);
 const before=entry({ribs:[rib('rib',8)],skin,bands:[band(0,8),band(8,20)],sideGap:.5});
 const after=entry({ribs:[rib('moved',8.01)],skin:{...skin,triangles:[0,1,3,1,2,3]},bands:[band(0,8),band(8,20)],sideGap:.55});
 const result=compareSupportGap(before,after);
 assert.deepEqual(result,{beforeCount:1,afterCount:1,removed:[],skins:[],spans:[]});
});
