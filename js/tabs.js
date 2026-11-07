(() => {
 const buttons=[...document.querySelectorAll('[data-tab]')];
 function activate(button,focus=false){
  const group=button.dataset.tabGroup,key=button.dataset.tab;
  buttons.filter(b=>b.dataset.tabGroup===group).forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  document.querySelectorAll('[data-panel-group]').forEach(p=>{if(p.dataset.panelGroup===group)p.hidden=p.id!=='page-'+key;});
  if(focus)button.focus();
  if(group==='workspace')window.dispatchEvent(new CustomEvent('workspace-tab-change',{detail:key}));
 }
 buttons.forEach(button=>{
  button.addEventListener('click',()=>activate(button));
  button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const peers=buttons.filter(b=>b.dataset.tabGroup===button.dataset.tabGroup),i=peers.indexOf(button);activate(peers[e.key==='Home'?0:e.key==='End'?peers.length-1:(i+(e.key==='ArrowRight'?1:-1)+peers.length)%peers.length],true);});
 });
 // Reveal a hidden invalid field before the browser tries to focus it.
 document.addEventListener('invalid',e=>{const panels=[];let node=e.target.parentElement;while(node){if(node.matches('[data-panel-group]'))panels.unshift(node);node=node.parentElement;}panels.forEach(p=>{const button=buttons.find(b=>b.getAttribute('aria-controls')===p.id);if(button)activate(button);});},true);
 buttons.filter(b=>b.getAttribute('aria-selected')==='true').forEach(b=>activate(b));
 function openLinkedTab(){
  const key=location.hash.slice(1);
  const button=buttons.find(b=>b.dataset.tabGroup==='workspace'&&b.dataset.tab===key);
  if(button)activate(button);
 }
 window.addEventListener('hashchange',openLinkedTab);
 document.querySelectorAll('.entry-nav a[href="#battle"]').forEach(link=>link.addEventListener('click',()=>{
  const button=buttons.find(b=>b.dataset.tabGroup==='workspace'&&b.dataset.tab==='battle');
  if(button)activate(button);
 }));
 openLinkedTab();
})();
