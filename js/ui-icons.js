(function(root){
 'use strict';
 // Status artwork comes only from its editable imagePath; no ID-to-file defaults.
 const paths={
  shield:'M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6Z',
  sword:'m5 19 13-13 3-3-1 6L7 21M4 14l6 6',
  wing:'M3 17 21 3l-6 18-4-8Z M11 13 21 3',
  heal:'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z',
  heart:'M12 21 3.5 12.5C-2 6 6 0 12 7c6-7 14-1 8.5 5.5Z',
  posture:'M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6Z M13 5l-3 6 5 2-4 6',
  star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  drop:'M12 3C9 8 4 12 4 16a8 8 0 0 0 16 0c0-4-5-8-8-13Z',
  speed:'m4 5 7 7-7 7m9-14 7 7-7 7',
  status:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v6m0 3v1',
  down:'m5 5 14 14M19 5 5 19',
  law:'M5 4h14v16H5Zm4 4h6m-6 4h6m-6 4h4'
 };
 const jobs={'守護':'shield','破陣':'sword','飛襲':'wing','支援':'heal'};
 function create(document,kind,label=''){
  const el=document.createElement('span');el.className='ui-icon';
  if(label){el.setAttribute('role','img');el.setAttribute('aria-label',label);el.title=label;}
  else el.setAttribute('aria-hidden','true');
  el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(paths[kind]||paths.status)+'"/></svg>';
  return el;
 }
 function createStatus(document,kind,label=''){
  const S=typeof module!=='undefined'?require('./statuses.js'):root.Statuses;
  const path=S?.imagePath?.(kind);
  if(!path)return create(document,'status',label);
  const host=document.createElement('span');host.className='status-art-icon';host.setAttribute('data-status-kind',kind);
  if(label){host.setAttribute('role','img');host.setAttribute('aria-label',label);host.title=label;}else host.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.hidden=true;img.alt='';img.setAttribute('aria-hidden','true');
  const fallback=create(document,'status');
  img.onload=()=>{img.hidden=false;fallback.hidden=true;};
  img.onerror=()=>{img.onerror=null;host.replaceChildren(create(document,'status'));};
  host.append(img,fallback);img.src=path;return host;
 }
 const api={create,createStatus,job:job=>jobs[job]||'status'};
 if(typeof module!=='undefined')module.exports=api;else root.UIIcons=api;
})(globalThis);
