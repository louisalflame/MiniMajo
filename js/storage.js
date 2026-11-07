(()=>{
 // Schema is descriptive metadata, never permission to erase user-authored data.
 const schema='alpha-20261025-fixed-editor-file',marker='minimajo.schema';
 const query=typeof location!=='undefined'?new URLSearchParams(location.search):null;
 const readOnlyPreview=query?.get('preview')==='1'&&query?.get('uiPreview')==='1';
 if(!readOnlyPreview&&!globalThis.document?.documentElement?.hasAttribute('data-public-release'))try{if(localStorage.getItem(marker)===null)localStorage.setItem(marker,schema);}catch(e){console.error('MiniMajo 無法讀取儲存資訊',e);}
 window.MiniMajoStorage={schema,readOnlyPreview};
})();
