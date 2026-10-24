import {cleanBinaryStl} from './clean-stl.js';
export async function saveStl(createData,download,{suggestedName='design.stl',isCurrent=()=>true}={}){
 const ensure=()=>{if(!isCurrent())throw Error('モデルや設定が変更されたためSTL保存を中止しました');};
 try{
  if(typeof window.showSaveFilePicker==='function'){
   const handle=await window.showSaveFilePicker({suggestedName,types:[{description:'STLモデル (*.stl)',accept:{'model/stl':['.stl']}}],excludeAcceptAllOption:true});
   const data=cleanBinaryStl(await createData());ensure();
   const writable=await handle.createWritable();
   try{ensure();await writable.write(data);ensure();await writable.close();}
   catch(error){try{await writable.abort();}catch{}throw error;}
   return 'STLを指定した場所に保存しました（mm）';
  }
  const entered=window.prompt('STLのファイル名を入力してください。保存先はブラウザーのダウンロード設定に従います。',suggestedName);
  if(entered===null)return null;
  let name=entered.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
  if(!name)throw Error('ファイル名を入力してください');
  if(!/\.stl$/i.test(name))name+='.stl';
  const data=cleanBinaryStl(await createData());ensure();download(data,name,'model/stl');
  return 'STLを出力しました。保存先を選ぶには、ブラウザーの「ダウンロード前に保存場所を確認」を有効にしてください。';
 }catch(error){if(error.name==='AbortError')return null;throw error;}
}
