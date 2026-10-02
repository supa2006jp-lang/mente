export async function saveStl(createData,download,{suggestedName='design.stl'}={}){
 try{
  if(typeof window.showSaveFilePicker==='function'){
   const handle=await window.showSaveFilePicker({suggestedName,types:[{description:'STLモデル (*.stl)',accept:{'model/stl':['.stl']}}],excludeAcceptAllOption:true});
   const data=await createData();
   const writable=await handle.createWritable();
   try{await writable.write(data);await writable.close();}
   catch(error){try{await writable.abort();}catch{}throw error;}
   return 'STLを指定した場所に保存しました（mm）';
  }
  const entered=window.prompt('STLのファイル名を入力してください。保存先はブラウザーのダウンロード設定に従います。',suggestedName);
  if(entered===null)return null;
  let name=entered.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
  if(!name)throw Error('ファイル名を入力してください');
  if(!/\.stl$/i.test(name))name+='.stl';
  download(await createData(),name,'model/stl');
  return 'STLを出力しました。保存先を選ぶには、ブラウザーの「ダウンロード前に保存場所を確認」を有効にしてください。';
 }catch(error){if(error.name==='AbortError')return null;throw error;}
}
