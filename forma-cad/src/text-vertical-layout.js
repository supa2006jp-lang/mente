const substitutions=new WeakMap();
function verticalSubstitutions(font){
 if(!substitutions.has(font)){
  const map=new Map();
  if(font.tables?.gsub&&font.substitution?.getSingle)for(const feature of ['vert','vrt2'])for(const [script,language]of [['DFLT',undefined],['hani',undefined],['hani','JAN '],['kana',undefined],['kana','JAN ']])for(const pair of font.substitution.getSingle(feature,script,language))map.set(pair.sub,pair.by);
  substitutions.set(font,map);
 }
 return substitutions.get(font);
}
const rotateCharacters=new Set([...'ー－—–‐-〜～…‥「」『』【】〈〉《》（）〔〕［］｛｝()[]{}<>']);

// Keep one upright character per cell. Newlines start columns to the left.
export function verticalTextRings(font,lines,{height,cellHeight=height,spacing,align,tolerance,flatten}){
 const em=font.unitsPerEm,unit=1000/em,os=font.tables?.os2,centerY=((os?.sTypoAscender??font.ascender)+(os?.sTypoDescender??font.descender))/2*unit,map=verticalSubstitutions(font);
 let commandCount=0;
 const columns=lines.map(line=>[...line.replace(/\t/g,'    ')].map(character=>{
  if(/\s/u.test(character))return {character,empty:true};
  const original=font.charToGlyph(character),index=map.get(original.index),glyph=index===undefined?original:font.glyphs.get(index),path=glyph.getPath(0,0,1000),box=path.getBoundingBox(),centerX=(original.advanceWidth||em)*unit/2;
  commandCount+=path.commands.length;if(commandCount>60000)throw Error('文字の輪郭が複雑すぎます。文字数を減らしてください');
  const rotate=index===undefined&&rotateCharacters.has(character),punctuation=index===undefined&&'、。'.includes(character),transform=([x,y])=>{x-=centerX;y-=centerY;if(rotate)[x,y]=[y,-x];if(punctuation){x+=600;y+=600;}return [x,y];};
  const corners=[[box.x1,-box.y1],[box.x1,-box.y2],[box.x2,-box.y1],[box.x2,-box.y2]].map(transform),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  return {character,path,transform,min:[Math.min(...xs),Math.min(...ys)],max:[Math.max(...xs),Math.max(...ys)],glyphIndex:glyph.index,substituted:index!==undefined,rotated:rotate};
 }));
 const glyphs=columns.flat().filter(g=>!g.empty&&g.path.commands.length),inkHeight=Math.max(0,...glyphs.map(g=>g.max[1]-g.min[1]));if(!(inkHeight>0))throw Error('輪郭のある文字を入力してください');
 const scale=height/inkHeight,cellScale=cellHeight/inkHeight,cell=Math.max(1000,...glyphs.map(g=>g.max[1]-g.min[1]))*cellScale,pitch=cell+spacing,columnPitch=Math.max(1000,...glyphs.map(g=>g.max[0]-g.min[0]))*cellScale*1.5,rings=[],placements=[];
 const longest=Math.max(...columns.map(c=>c.length));
 for(let col=0;col<columns.length;col++){
  const extra=(longest-columns[col].length)*pitch,shift=align==='center'?extra/2:align==='right'?extra:0;
  for(let row=0;row<columns[col].length;row++){
   const glyph=columns[col][row];if(glyph.empty)continue;const x=(columns.length-1-col)*columnPitch,y=-row*pitch-shift;
   const rs=flatten(glyph.path.commands,tolerance/scale).map(r=>r.map(p=>{const q=glyph.transform(p);return [x+q[0]*scale,y+q[1]*scale];}));rings.push(...rs);
   placements.push({character:glyph.character,column:col,row,center:[x,y],glyphIndex:glyph.glyphIndex,substituted:glyph.substituted,rotated:glyph.rotated});
  }
 }
 // Vertical alignment acts within columns; keep the whole block's left origin stable.
 const xs=rings.flat().map(p=>p[0]),shift=Math.min(...xs);
 return {rings:rings.map(r=>r.map(p=>[p[0]-shift,p[1]])),glyphs:placements,pitch,columnPitch,columns:columns.length};
}
