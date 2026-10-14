const axes=['X','Y','Z'],epsilon=1e-5;
export function printDimensions(items,capacity=[180,180,180]){
 if(!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(item=>item.id)).size!==items.length)throw Error('寸法を確認するソリッドを選択してください');
 if(!Array.isArray(capacity)||capacity.length!==3||capacity.some(value=>!Number.isFinite(value)||value<=0||value>10000))throw Error('造形範囲は各軸0より大きく、10000 mm以下で指定してください');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const bodies=items.map(item=>{
  if(typeof item.id!=='string'||!item.id||![item.min,item.max].every(point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite))||item.min.some((value,i)=>value>item.max[i]))throw Error('ソリッドの外形寸法を取得できません');
  for(let i=0;i<3;i++){min[i]=Math.min(min[i],item.min[i]);max[i]=Math.max(max[i],item.max[i]);}
  return {...item,size:item.max.map((value,i)=>value-item.min[i])};
 });
 const size=max.map((value,i)=>value-min[i]);
 const dimensions=axes.map((axis,i)=>({axis,length:size[i],limit:capacity[i],remaining:capacity[i]-size[i],fits:size[i]<=capacity[i]+epsilon}));
 return {min,max,size,bodies,dimensions,fits:dimensions.every(axis=>axis.fits)};
}
