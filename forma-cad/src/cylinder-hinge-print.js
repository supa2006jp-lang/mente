// Rotate and translate the entire captive assembly with one shared rigid transform.
export function pairBounds(parts){
 const boxes=parts.map(s=>s.boundingBox);
 try{const min=[0,1,2].map(i=>Math.min(...boxes.map(b=>b.bounds[0][i]))),max=[0,1,2].map(i=>Math.max(...boxes.map(b=>b.bounds[1][i])));return {min,max,width:max[0]-min[0],depth:max[1]-min[1]};}
 finally{boxes.forEach(b=>b.delete());}
}
export function arrangeHingePair(parts,margin=2){
 if(!Number.isFinite(margin)||margin<0||margin>20)throw Error('プレート端の余白は0〜20 mmで指定してください');
 let best;
 const inspect=angle=>{
  const moved=[];try{for(const s of parts)moved.push(s.clone().rotate(angle,[0,0,0],[0,0,1]));const bounds=pairBounds(moved),score=Math.max(bounds.width,bounds.depth);if(!best||score<best.score-1e-6)best={angle,bounds,score};}finally{moved.forEach(s=>s.delete());}
 };
 for(let angle=0;angle<=90;angle+=5)inspect(angle);
 const coarse=best.angle;for(let angle=Math.max(0,coarse-5);angle<=Math.min(90,coarse+5)+1e-6;angle+=.5)inspect(angle);
 const fine=best.angle;for(let angle=Math.max(0,fine-.5);angle<=Math.min(90,fine+.5)+1e-6;angle+=.05)inspect(Number(angle.toFixed(2)));
 const shift=[-(best.bounds.min[0]+best.bounds.max[0])/2,-(best.bounds.min[1]+best.bounds.max[1])/2,-best.bounds.min[2]],moved=[];
 try{
  for(const shape of parts)moved.push(shape.clone().rotate(best.angle,[0,0,0],[0,0,1]).translate(shift));
  const bounds=pairBounds(moved);
  return {parts:moved,layout:{angle:best.angle,translation:shift,margin,requiredWidth:bounds.width+2*margin,requiredDepth:bounds.depth+2*margin,requiredSquare:Math.max(bounds.width,bounds.depth)+2*margin,fits:Math.max(bounds.width,bounds.depth)+2*margin<=180+1e-5}};
 }catch(e){moved.forEach(s=>s.delete());throw e;}
}
