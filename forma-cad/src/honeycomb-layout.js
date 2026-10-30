export const honeycombDefaults={cell:10,rib:1.5,thickness:2,border:3,hollow:true,scope:'all',heightAxis:'Z'};
export function honeycombSettings(input={}){
 const p={...honeycombDefaults,...input};
 for(const [key,min,max]of [['cell',1,500],['rib',.4,100],['thickness',.4,100],['border',.4,500]])
  if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error({cell:'六角穴の幅',rib:'格子の幅',thickness:'側壁の厚み',border:'端の枠幅'}[key]+'は'+min+'〜'+max+' mmで指定してください');
 if(typeof p.hollow!=='boolean'||!['all','selected'].includes(p.scope)||!['X','Y','Z'].includes(p.heightAxis))throw Error('ハニカムの設定を確認してください');
 return p;
}
export function hexagon(width){const a=width/2,b=width/Math.sqrt(3);return [[0,b],[-a,b/2],[-a,-b/2],[0,-b],[a,-b/2],[a,b/2]];}
export function honeycombLayout(width,height,input={},periodic=false){
 const p=honeycombSettings(input),border=Math.max(p.border,p.thickness),hex=hexagon(p.cell),halfHeight=p.cell/Math.sqrt(3),stepY=(p.cell+p.rib)*Math.sqrt(3)/2;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('側面の大きさを確認してください');
 const rows=Math.floor((height-2*border-2*halfHeight+1e-7)/stepY)+1;
 if(rows<1)return {centers:[],hex,rows:0,columns:0};
 const columns=periodic?Math.floor(width/(p.cell+p.rib)):Math.floor((width-2*border+p.rib)/(p.cell+p.rib));
 if(columns<1||rows*columns>240) {if(columns<1)return {centers:[],hex,rows:0,columns:0};throw Error('六角穴は合計240個までです。穴の幅や格子の幅を大きくしてください');}
 const pitch=periodic?width/columns:p.cell+p.rib,centers=[];
 const bottom=(height-(rows-1)*stepY)/2;
 for(let row=0;row<rows;row++){
  if(periodic){for(let col=0;col<columns;col++)centers.push([(col+(row%2)/2)*pitch,bottom+row*stepY]);}
  else{
   // Alternate rows have one fewer cell, centred together, preserving full borders.
   const n=columns-(row%2&&columns>1?1:0),start=(width-(n-1)*pitch)/2;
   for(let col=0;col<n;col++)centers.push([start+col*pitch,bottom+row*stepY]);
  }
 }
 return {centers,hex,rows,columns,pitch};
}
