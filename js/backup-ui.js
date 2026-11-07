(()=>{
 const $=id=>document.getElementById(id),say=t=>$('database-message').textContent=t;
 function report(warnings){$('database-recovery').hidden=!warnings.length;$('database-recovery-summary').textContent='資料補值紀錄（'+warnings.length+' 項）';$('database-recovery-details').textContent=warnings.join('\n');}
 report(SavedData.warnings);if(SavedData.warnings.length)say('固定檔案已讀取並補入預設值；原始 JSON 檔案尚未覆寫。請查看補值紀錄。');
 $('database-export').onclick=()=>{if(!confirm('匯出各分頁「已儲存」的全部編輯資料。尚未儲存的修改與遊戲進度不包含在內，繼續匯出？'))return;try{const data=EditorBackup.collect(localStorage),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='minimajo-editor.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);report(SavedData.warnings);say('已匯出全部已儲存編輯資料（缺少或無效欄位已補預設值）。');}catch(e){say('匯出失敗：'+e.message);}};
 $('database-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
  if(file.size>20000000)throw Error('備份不得超過 20 MB。');const prepared=EditorBackup.prepare(JSON.parse(await file.text()));report(prepared.warnings);
  const summary=prepared.warnings.length?'\n已補值 '+prepared.warnings.length+' 項：\n'+prepared.warnings.slice(0,8).join('\n')+(prepared.warnings.length>8?'\n其餘見頁面補值紀錄。':''):'';
  if(!confirm('以備份覆蓋 minimajo-editor.json 的全部編輯資料，並重新載入編輯器？未儲存修改將捨棄。'+summary))return;
  await EditorFileSession.replace(prepared.file);say('固定資料檔已取代，正在重新載入。');location.reload();
 }catch(error){say('匯入失敗：'+error.message);}finally{e.target.value='';}};
})();
