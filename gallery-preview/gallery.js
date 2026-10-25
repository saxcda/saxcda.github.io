'use strict';
(() => {
 const works = [...document.querySelectorAll('.work')];
 const filters = [...document.querySelectorAll('[data-filter]')];
 const dialog = document.querySelector('#viewer');
 const image = document.querySelector('#full-photo');
 let selected = null, opener = null, historyOwned = false;
 const visible = () => works.filter(work => !work.hidden);
 const photoHash = id => '#photo=' + encodeURIComponent(id);
 function render(work) {
  selected = work;
  const link = work.querySelector('a');
  const thumb = work.querySelector('img');
  image.hidden = false;
  document.querySelector('#image-error').hidden = true;
  image.src = link.getAttribute('href');
  image.alt = thumb.alt;
  document.querySelector('#photo-title').textContent = work.querySelector('b').textContent;
  const list = visible();
  document.querySelector('#position').textContent = (list.indexOf(work) + 1) + ' / ' + list.length;
 }
 function show(work, push = true) {
  opener = work.querySelector('a');
  render(work);
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('viewing'); }
  if (push) { history.pushState({gallery:true}, '', photoHash(opener.dataset.id)); historyOwned = true; }
  document.querySelector('#close').focus();
 }
 function hide() {
  if (!dialog.open) return;
  dialog.close(); document.body.classList.remove('viewing');
  if (opener && !opener.closest('.work').hidden) opener.focus();
  selected = null;
 }
 function close() {
  if (historyOwned) { historyOwned = false; history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search + '#gallery'); hide(); }
 }
 function step(delta) {
  const list = visible();
  if (!selected || !list.length) return;
  render(list[(list.indexOf(selected) + delta + list.length) % list.length]);
  history.replaceState(history.state, '', photoHash(selected.querySelector('a').dataset.id));
 }
 function sync() {
  const id = location.hash.startsWith('#photo=') ? location.hash.slice(7) : '';
  const match = works.find(work => encodeURIComponent(work.querySelector('a').dataset.id) === id);
  if (match) {
   if (match.hidden) filter('all');
   show(match, false);
  } else { historyOwned = false; hide(); }
 }
 function filter(value) {
  works.forEach(work => { work.hidden = value !== 'all' && work.dataset.category !== value; });
  filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === value)));
  document.querySelector('.wall').classList.toggle('filtered', value !== 'all');
  document.querySelector('#result').textContent = '顯示 ' + visible().length + ' 件作品';
 }
 works.forEach(work => work.querySelector('a').addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
  event.preventDefault(); show(work);
 }));
 filters.forEach(button => button.addEventListener('click', () => filter(button.dataset.filter)));
 document.querySelector('#close').addEventListener('click', close);
 document.querySelector('#previous').addEventListener('click', () => step(-1));
 document.querySelector('#next').addEventListener('click', () => step(1));
 dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
 dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1); }
 });
 image.addEventListener('error', () => { image.hidden = true; document.querySelector('#image-error').hidden = false; });
 window.addEventListener('popstate', sync);
 if (typeof dialog.showModal === 'function') sync();
})();
