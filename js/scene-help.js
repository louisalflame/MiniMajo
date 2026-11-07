if(!globalThis.MiniMajoViewport?.host)document.querySelectorAll('[data-scene-help]').forEach(trigger => {
 const dialog = document.getElementById(trigger.getAttribute('aria-controls'));
 const close = () => { if (dialog.open) dialog.close(); };

 trigger.addEventListener('click', () => {
  if (dialog.open) return;
  dialog.showModal();
  trigger.setAttribute('aria-expanded', 'true');
  dialog.focus({preventScroll:true});
 });
 dialog.addEventListener('cancel', event => {
  event.preventDefault();
  close();
 });
 dialog.addEventListener('close', () => {
  trigger.setAttribute('aria-expanded', 'false');
  trigger.focus({preventScroll:true});
 });
 DialogDismiss.bind(dialog, close);
});
