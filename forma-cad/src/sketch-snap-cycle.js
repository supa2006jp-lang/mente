const key=c=>c.kind+':'+c.point.toArray().map(v=>Math.round(v*1e6)).join(',');

// Keep the automatically preferred snap first. A manual choice survives the
// mouse-up re-evaluation, small pointer motion and changes in candidate order.
export function createSketchSnapCycle(){
 let items=[],chosen=null,anchor=null,revision=null,context=null,index=0;
 function clear(){items=[];chosen=anchor=revision=context=null;index=0;}
 return {
  clear,
  resolve(candidates,pointer,nextRevision,nextContext){
   if(revision!==nextRevision||context!==nextContext||!anchor||Math.hypot(pointer.x-anchor.x,pointer.y-anchor.y)>6){chosen=null;anchor={...pointer};}
   revision=nextRevision;context=nextContext;const unique=new Map();for(const c of candidates){const id=key(c);if(!unique.has(id))unique.set(id,{...c,key:id});}items=[...unique.values()].slice(0,16);
   index=chosen?items.findIndex(c=>c.key===chosen):0;if(index<0){index=0;chosen=null;}return items[index]||null;
  },
  cycle(direction=1){if(items.length<2)return false;index=(index+direction+items.length)%items.length;chosen=items[index].key;return true;},
  get selected(){return items[index]||null;},get items(){return items;},get index(){return index;}
 };
}
