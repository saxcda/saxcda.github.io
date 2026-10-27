'use strict';
(() => {
 const MAX=200, MAX_FILE=20*1024*1024, MAX_BATCH=150*1024*1024, MAX_JSON=160*1024*1024;
 const safeSource=s=>typeof s==='string' && (/^assets\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/.test(s)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
 function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.photos)||!data.photos.length||data.photos.length>MAX)throw Error('收藏必須包含 1–200 張照片，版本須為 1。');
  const ids=new Set();
  return data.photos.map(p=>{if(!p||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id)||!safeSource(p.src)||!safeSource(p.thumb||p.src))throw Error('收藏有重複 ID、無效圖片或不安全的來源路徑。');ids.add(p.id);return {id:p.id,title:String(p.title||'Untitled').slice(0,160),alt:String(p.alt||'照片，尚待補充替代文字').slice(0,500),src:p.src,thumb:p.thumb||p.src};});
 }
 function compact(p){const item={...p};if(item.thumb===item.src)delete item.thumb;return item;}
 const withinBudget=bytes=>Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=MAX_JSON;
 function serializedSize(photos){let bytes=new TextEncoder().encode('{"version":1,"photos":[]}').byteLength;for(let i=0;i<photos.length;i++){const item=compact(photos[i]);const src=item.src,thumb=item.thumb;item.src='';if(thumb!==undefined)item.thumb='';bytes+=new TextEncoder().encode(JSON.stringify(item)).byteLength+src.length+(thumb===undefined?0:thumb.length)+(i?1:0);}return bytes;}
 function serialize(photos){if(!withinBudget(serializedSize(photos)))throw Error('收藏備份超過總容量 160 MiB，請減少本批照片大小；原收藏未更動。');return JSON.stringify({version:1,photos:photos.map(compact)});}
 function combine(existing,incoming,restore=false){const result=restore?incoming:[...existing,...incoming.filter(p=>!existing.some(e=>e.id===p.id))];const checked=validate({version:1,photos:result});serialize(checked);return checked;}
 const canMarkSaved=(savedRevision,currentRevision)=>savedRevision===currentRevision;
 if(typeof module!=='undefined' && module.exports){module.exports={validate,safeSource,serialize,combine,canMarkSaved,MAX_JSON,serializedSize,withinBudget};return;}
 const $=id=>document.getElementById(id); let photos=validate(window.GALLERY_COLLECTION),current=0,busy=false,changed=false,revision=0,saving=false,db;
 const mutate=()=>{revision++;changed=true;};
 const announce=t=>{$('status').textContent=t;};
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let flat=reduced.matches || !CSS.supports('transform-style','preserve-3d');
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function image(p,full=false){const img=el('img');img.src=full?p.src:p.thumb;img.alt=p.alt;img.decoding='async';if(!full)img.loading='lazy';img.addEventListener('error',()=>{img.alt=`圖片無法載入：${p.alt}`;});return img;}
 function render(){
  $('frames').replaceChildren();
  const slots=photos.length===1?[[0,'center']]:photos.length===2?[[0,'center'],[1,'right']]:[[-1,'left'],[0,'center'],[1,'right']];
  for(const [offset,slot] of slots){const idx=(current+offset+photos.length)%photos.length,p=photos[idx],b=el('button',`frame ${slot}`);b.type='button';b.setAttribute('aria-label',slot==='center'?`放大 ${p.title}`:`移至 ${p.title}`);b.append(image(p),el('span','caption',p.title));b.onclick=()=>slot==='center'?openViewer():move(offset);$('frames').append(b);}
  $('counter').textContent=`${String(current+1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;$('current-title').textContent=photos[current].title;
  $('prev').disabled=$('next').disabled=photos.length<2;
  if($('viewer').open)renderViewer();
 }
 function renderGrid(){const frag=document.createDocumentFragment();photos.forEach((p,i)=>{const b=el('button');b.type='button';b.setAttribute('aria-label',`放大 ${p.title}`);b.append(image(p),el('span','',`${String(i+1).padStart(2,'0')} / ${p.title}`));b.onclick=()=>{current=i;render();openViewer();};const item=el('div');const link=el('a','full-link','開啟完整照片 ↗');link.href=p.src;link.target='_blank';link.rel='noopener';item.append(b,link);frag.append(item);});$('grid').replaceChildren(frag);}
 function renderEditor(){const frag=document.createDocumentFragment();photos.forEach(p=>{const row=el('div','edit-row');row.append(image(p));for(const [key,label] of [['title','作品名稱'],['alt','替代文字（描述畫面）']]){const l=el('label','',label),input=el('input');input.value=p[key];input.maxLength=key==='title'?160:500;input.onchange=()=>{const value=input.value.trim()||(key==='title'?'Untitled':'照片，尚待補充替代文字');try{serialize(photos.map(row=>row===p?{...row,[key]:value}:row));p[key]=value;mutate();render();renderGrid();announce('文字已更新；請儲存或匯出收藏。');}catch(e){input.value=p[key];announce(e.message);}};l.append(input);row.append(l);}frag.append(row);});$('editor').replaceChildren(frag);}
 function refresh(){render();renderGrid();renderEditor();}
 function mode(value){flat=value;$('space').hidden=flat;$('grid').hidden=!flat;$('spatial').setAttribute('aria-pressed',String(!flat));$('grid-mode').setAttribute('aria-pressed',String(flat));}
 function move(delta){current=(current+delta+photos.length)%photos.length;render();announce(`第 ${current+1} 件，共 ${photos.length} 件：${photos[current].title}`);}
 function renderViewer(){const p=photos[current];$('photo-error').hidden=true;$('full-photo').src=p.src;$('full-photo').alt=p.alt;$('photo-title').textContent=p.title;$('photo-position').textContent=`${current+1} / ${photos.length}`;}
 function openViewer(){renderViewer();if(typeof $('viewer').showModal==='function')$('viewer').showModal();else {mode(true);announce('此瀏覽器不支援放大視窗，已改用平面畫廊。');}}
 $('full-photo').onerror=()=>{$('photo-error').hidden=false;};$('close').onclick=()=>$('viewer').close();$('prev').onclick=$('viewer-prev').onclick=()=>move(-1);$('next').onclick=$('viewer-next').onclick=()=>move(1);
 $('viewer').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}});
 $('spatial').onclick=()=>mode(false);$('grid-mode').onclick=()=>mode(true);reduced.addEventListener('change',e=>{if(e.matches)mode(true);});
 function read(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('無法讀取照片。'));r.readAsDataURL(file);});}
 function decode(src){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>res();img.onerror=()=>rej(Error('照片內容無法解碼。'));img.src=src;});}
 async function add(files){if(busy)return;busy=true;try{const list=Array.from(files);if(!list.length)return;if(photos.length+list.length>MAX||list.reduce((n,f)=>n+f.size,0)>MAX_BATCH)throw Error('超過 200 張收藏或每批 150 MB 上限，請分批加入。');const additions=[];for(const f of list){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>MAX_FILE)throw Error(`${f.name}：只接受 20 MB 以下的 JPG、PNG、WebP。`);const src=await read(f);await decode(src);if(photos.some(p=>p.src===src)||additions.some(p=>p.src===src))continue;additions.push({id:`local-${Date.now()}-${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`,title:f.name.replace(/\.[^.]+$/,''),alt:'自行加入的照片，請在收藏工作台補充畫面描述',src,thumb:src});}photos=combine(photos,additions);mutate();refresh();announce(`已加入 ${additions.length} 張；相同檔案內容略過。尚未儲存，照片未上傳。`);}catch(e){announce(e.message+' 本批未加入。');}finally{busy=false;$('files').value='';}}
 $('files').onchange=e=>add(e.target.files);$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over');};$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');add(e.dataTransfer.files);};
 $('export').onclick=()=>{const blob=new Blob([serialize(photos)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='eric-li-collection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('收藏已交給瀏覽器下載；請確認檔案已保存。');};
 $('import').onchange=async e=>{if(busy)return;busy=true;try{const f=e.target.files[0];if(!f)return;if(f.size>MAX_JSON)throw Error('JSON 超過 160 MiB 總容量上限。');const incoming=validate(JSON.parse(await f.text())),restore=$('import-mode').value==='restore';for(const p of incoming){if(p.src.startsWith('data:'))await decode(p.src);}if(restore&&!window.confirm('以此備份取代目前瀏覽器中的收藏（含名稱與描述）？尚未匯出的變更會離開目前畫面；原始圖片檔不受影響。取消可保留目前收藏。'))return;const candidate=combine(photos,incoming,restore);photos=candidate;current=0;mutate();refresh();announce(restore?'已還原備份的完整收藏與文字；尚未儲存到此瀏覽器。':'已合併收藏；同 ID 保留目前版本。尚未儲存。');}catch(err){announce('匯入失敗：'+err.message);}finally{busy=false;e.target.value='';}};
 function openDB(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('此瀏覽器不支援本機儲存。'));const req=indexedDB.open('eric-li-gallery-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('collections');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('本機資料庫被其他分頁占用。'));});}
 $('save').onclick=async()=>{if(saving||busy)return;saving=true;$('save').disabled=true;try{db=db||await openDB();const savedRevision=revision,snapshot=JSON.parse(serialize(photos));await new Promise((resolve,reject)=>{const tx=db.transaction('collections','readwrite');tx.objectStore('collections').put(snapshot,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});if(canMarkSaved(savedRevision,revision)){changed=false;announce('已儲存在此瀏覽器。不是雲端備份，請另匯出 JSON。');}else announce('較早版本已儲存；儲存期間另有變更，請再儲存或匯出。');}catch(e){announce('本機儲存失敗（可能容量不足或存取受限）；請匯出 JSON 備份。');}finally{saving=false;$('save').disabled=false;}};
 // Avoid an asynchronous saved collection overwriting edits made during startup.
 refresh();mode(flat);openDB().then(database=>{db=database;const req=db.transaction('collections').objectStore('collections').get('current');req.onsuccess=()=>{if(req.result&&revision===0&&!changed&&!busy&&!saving){try{const restored=validate(req.result);serialize(restored);photos=restored;current=0;refresh();announce('已載入此瀏覽器儲存的收藏。');}catch{announce('本機收藏格式無效，保留預設作品；未覆寫儲存內容。');}}};}).catch(()=>announce('本機儲存不可用；仍可瀏覽、加入照片與匯出 JSON。'));
 window.addEventListener('beforeunload',e=>{if(changed){e.preventDefault();e.returnValue='';}});
})();
