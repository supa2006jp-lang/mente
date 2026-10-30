export const honeycombDefaults={cell:10,rib:1.5,thickness:2,border:3,hollow:true,scope:'all',heightAxis:'Z',topOpen:false,bottomOpen:false,layout:'size',columns:6,rows:4};
export function honeycombSettings(input={}){
 const p={...honeycombDefaults,...input};
 if(p.topBorder===undefined)p.topBorder=p.border;if(p.bottomBorder===undefined)p.bottomBorder=p.border;
 for(const [key,min,max]of [['cell',1,500],['rib',.4,100],['thickness',.4,100],['border',.4,500],['topBorder',.4,500],['bottomBorder',.4,500]])
  if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error({cell:'六角穴の幅',rib:'格子の幅',thickness:'側壁の厚み',border:'角の枠幅',topBorder:'上側の枠幅',bottomBorder:'下側の枠幅'}[key]+'は'+min+'〜'+max+' mmで指定してください');
 if(typeof p.hollow!=='boolean'||!['all','selected'].includes(p.scope)||!['X','Y','Z'].includes(p.heightAxis))throw Error('ハニカムの設定を確認してください');
 if(typeof p.topOpen!=='boolean'||typeof p.bottomOpen!=='boolean'||!['size','count'].includes(p.layout))throw Error('開口・配置方法の設定を確認してください');
 if(!p.hollow&&(p.topOpen||p.bottomOpen))throw Error('上面・底面を開く場合は「内側を空洞にする」をONにしてください');
 for(const key of ['columns','rows'])if(!Number.isInteger(p[key])||p[key]<1||p[key]>100)throw Error('横の個数・段数は1〜100の整数で指定してください');
 return p;
}
export function hexagon(width){const a=width/2,b=width/Math.sqrt(3);return [[0,b],[-a,b/2],[-a,-b/2],[0,-b],[a,-b/2],[a,b/2]];}
export function honeycombLayout(width,height,input={},periodic=false,resolvedCell=null){
 const p=honeycombSettings(input),border=Math.max(p.border,p.thickness),bottomBorder=Math.max(p.bottomBorder,p.thickness),topBorder=Math.max(p.topBorder,p.thickness),availableHeight=height-bottomBorder-topBorder;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('側面の大きさを確認してください');
 const cell=resolvedCell??(p.layout==='count'?countCell(width,height,p,periodic):p.cell),hex=hexagon(cell),halfHeight=cell/Math.sqrt(3);
 let stepY=(cell+p.rib)*Math.sqrt(3)/2;
 const rows=p.layout==='count'?p.rows:Math.floor((availableHeight-2*halfHeight+1e-7)/stepY)+1;
 if(rows<1)return {centers:[],hex,rows:0,columns:0};
 const columns=p.layout==='count'?p.columns:periodic?Math.floor(width/(cell+p.rib)):Math.floor((width-2*border+p.rib)/(cell+p.rib));
 if(columns<1||rows*columns>240) {if(columns<1)return {centers:[],hex,rows:0,columns:0};throw Error('六角穴は合計240個までです。穴の幅や格子の幅を大きくしてください');}
 const pitch=periodic?width/columns:p.layout==='count'&&columns>1?(width-2*border-cell)/(columns-1):cell+p.rib,centers=[];
 if(p.layout==='count'&&rows>1)stepY=(availableHeight-2*halfHeight)/(rows-1);
 const bottom=bottomBorder+(availableHeight-(rows-1)*stepY)/2;
 for(let row=0;row<rows;row++){
  if(periodic){for(let col=0;col<columns;col++)centers.push([(col+(row%2)/2)*pitch,bottom+row*stepY]);}
  else{
   // Alternate rows have one fewer cell, centred together, preserving full borders.
   const n=columns-(row%2&&columns>1?1:0),start=(width-(n-1)*pitch)/2;
   for(let col=0;col<n;col++)centers.push([start+col*pitch,bottom+row*stepY]);
  }
 }
 return {centers,hex,rows,columns,pitch,cell,topBorder,bottomBorder};
}
function countCell(width,height,p,periodic=false){
 const border=Math.max(p.border,p.thickness),w=(width-(periodic?0:2*border)-(p.columns-1)*p.rib)/p.columns;
 const h=(height-Math.max(p.bottomBorder,p.thickness)-Math.max(p.topBorder,p.thickness)-(p.rows-1)*p.rib*Math.sqrt(3)/2)/(2/Math.sqrt(3)+(p.rows-1)*Math.sqrt(3)/2);
 return Math.min(w,h,500);
}
function sidesFor(info,p){
 if(info.kind==='cylinder')return [{width:2*Math.PI*(info.radius-p.thickness),side:0}];
 const u=info.u,v=info.v,negative=a=>a.map(x=>-x),sides=[{at:[0,0,0],u,n:negative(v),width:info.width},{at:[info.width,info.depth,0],u:negative(u),n:v,width:info.width},{at:[0,info.depth,0],u:negative(v),n:negative(u),width:info.depth},{at:[info.width,0,0],u:v,n:u,width:info.depth}];
 if(p.scope!=='selected')return sides;
 if(!Array.isArray(p.faceNormal)||p.faceNormal.length!==3||!p.faceNormal.every(Number.isFinite)||Math.hypot(...p.faceNormal)<.9)throw Error('加工したい箱の側面を先にクリックしてください');
 const norm=Math.hypot(...p.faceNormal),matches=sides.filter(s=>s.n.reduce((sum,n,i)=>sum+n*p.faceNormal[i]/norm,0)>.999);
 if(!matches.length)throw Error('上面・底面ではなく箱の側面を選択してください');return matches;
}
function rawPlan(info,p){
 const periodic=info.kind==='cylinder',sides=sidesFor(info,p),inner=info.radius-p.thickness;
 if(periodic&&p.scope==='selected')throw Error('円柱は側面を一周加工します。加工範囲を「全側面」にしてください');
 if(info.height<=2*p.thickness+.1||(periodic?inner<=.1:Math.min(info.width,info.depth)<=2*p.thickness+.1))throw Error('側壁の厚みが大きすぎます。内側に空間が残る値にしてください');
 if(periodic&&p.layout==='count'&&p.columns<3)throw Error('円柱の横の個数は1周3個以上にしてください');
 let cell=p.cell;
 if(p.layout==='count'){
  const width=periodic?p.columns*(Math.min(2*inner*Math.sin(Math.PI/p.columns),inner*1.39))-p.rib:Math.min(...sides.map(s=>s.width));
  cell=countCell(width,info.height,p,periodic);
  if(!(cell>=1))throw Error('指定した個数・段数では穴を1 mm以上にできません');
 }
 if(periodic&&cell+p.rib>=inner*1.4)throw Error('円柱に対して六角穴が大きすぎます。穴や格子の幅を小さくしてください');
 const columns=periodic?(p.layout==='count'?p.columns:Math.floor(2*Math.PI/(2*Math.asin((cell+p.rib)/(2*inner))))):null;
 const grids=sides.map(side=>({...side,...honeycombLayout(periodic?columns*(cell+p.rib):side.width,info.height,{...p,cell},periodic,cell)}));
 const holeCount=grids.reduce((sum,grid)=>sum+grid.centers.length,0);
 if(!holeCount)throw Error('この大きさでは六角穴を配置できません。穴の幅か端の枠幅を小さくしてください');
 if(holeCount>240)throw Error('六角穴は合計240個までです');
 return {settings:{...p,cell},grids,holeCount,cell,rows:grids[0].rows,columns:grids[0].columns};
}
export function recommendHoneycombCounts(info,input={}){
 const p=honeycombSettings(input),periodic=info.kind==='cylinder',minC=periodic?3:1,b=Math.max(p.border,p.thickness);
 const wantedC=p.layout==='count'?p.columns:Math.max(minC,Math.floor((periodic?2*Math.PI*(info.radius-p.thickness):Math.min(info.width,info.depth)-2*b)/(p.cell+p.rib)));
 const wantedR=p.layout==='count'?p.rows:Math.max(1,Math.floor((info.height-Math.max(p.topBorder,p.thickness)-Math.max(p.bottomBorder,p.thickness)-2*p.cell/Math.sqrt(3))/((p.cell+p.rib)*Math.sqrt(3)/2))+1);
 let best=null;
 for(let columns=minC;columns<=Math.min(100,wantedC);columns++)for(let rows=1;rows<=Math.min(100,wantedR);rows++){
  const cost=((wantedC-columns)/wantedC)**2+((wantedR-rows)/wantedR)**2;
  if(best&&cost>=best.cost)continue;
  if(columns*rows*(periodic||p.scope==='selected'?1:4)>240+2*rows)continue;
  try{const plan=rawPlan(info,{...p,layout:'count',columns,rows});best={cost,layout:'count',columns,rows,cell:plan.cell,holeCount:plan.holeCount};}catch{}
 }
 return best;
}
export function planHoneycomb(info,input={}){
 const p=honeycombSettings(input);
 try{return rawPlan(info,p);}catch(error){
  // Offers a concrete fitting setting; the caller applies it only on request.
  if(/個|段数|配置|大きすぎ|細かすぎ/.test(error.message)){
   const suggestion=recommendHoneycombCounts(info,p);
   if(suggestion)error.diagnostics={honeycombSuggestion:suggestion};
  }
  throw error;
 }
}
