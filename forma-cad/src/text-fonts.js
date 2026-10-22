// Static, redistributable outline fonts; no system-font access or external runtime requests.
export const TEXT_FONTS=Object.freeze([
 {id:'gothic',label:'ゴシック',name:'Noto Sans CJK JP',file:'NotoSansCJKjp-Regular.otf'},
 {id:'gothic-bold',label:'太字ゴシック',name:'Noto Sans CJK JP Bold',file:'NotoSansCJKjp-Bold.otf'},
 {id:'mincho',label:'明朝',name:'Noto Serif CJK JP',file:'NotoSerifCJKjp-Regular.otf'},
 {id:'rounded',label:'丸ゴシック',name:'Zen Maru Gothic',file:'ZenMaruGothic-Regular.ttf'}
].map(Object.freeze));
export const DEFAULT_TEXT_FONT=TEXT_FONTS[0].id;
export const TEXT_FONT_ASSETS=[...TEXT_FONTS.map(f=>f.file),'OFL.txt','NotoSerif-OFL.txt','ZenMaruGothic-OFL.txt','NOTICE.txt'];

export function createTextFontLibrary(parse,{fetchFont=(...args)=>fetch(...args)}={}){
 const cache=new Map();
 return {load(id){
  const entry=TEXT_FONTS.find(font=>font.id===id);if(!entry)return Promise.reject(Error('フォントを選んでください'));
  if(!cache.has(id)){
   const pending=(async()=>{const response=await fetchFont('fonts/'+entry.file);if(!response.ok)throw Error(entry.label+'を読み込めません。選び直して再試行するか、フォントファイルを指定してください');return parse(await response.arrayBuffer());})();
   cache.set(id,pending);pending.catch(()=>{if(cache.get(id)===pending)cache.delete(id);});
  }
  return cache.get(id);
 }};
}
