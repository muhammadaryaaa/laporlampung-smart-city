/* LaporLampung v2.0.0 - Google Stitch design implementation
   Design: Google Stitch project "LaporLampung Citizen Reporting App" (Material Design 3).
   Previous fixes retained: testing fixes v1.1, security fixes v1.2.
   Frontend demo mirrors PostgreSQL schema. Production API: Rust Axum in ../backend-rust. */
'use strict';
const CATEGORIES=['Jalan Rusak','Lampu Jalan','Sampah & Kebersihan','Drainase & Banjir','Fasilitas Publik','Taman & Ruang Publik','Lalu Lintas','Air Bersih'];
const DISTRICTS=['Bumi Waras','Enggal','Kedamaian','Kedaton','Kemiling','Labuhan Ratu','Langkapura','Panjang','Rajabasa','Sukabumi','Sukarame','Tanjung Karang Barat','Tanjung Karang Pusat','Tanjung Karang Timur','Teluk Betung Barat','Teluk Betung Selatan','Teluk Betung Timur','Teluk Betung Utara','Way Halim','Sukabumi Indah'];
const SESSION_MS=2*60*60*1000; // SEC-07: session expiry 2 hours
const MAX_LOGIN_FAIL=5, LOCK_MS=5*60*1000; // SEC-04: lockout

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function sanitizeText(v){return String(v??'').replace(/<[^>]*>/g,'').trim();}
function isValidEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);}
function ticketId(r){const n=typeof r.id==='number'&&r.id<10000?r.id:(Math.abs(Number(r.id)||0)%10000);return '#BDL-2026-'+String(n).padStart(4,'0');}
function initials(name){return String(name||'?').split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();}

const USERS=[
 {id:1,name:'Arya Warga',email:'warga@laporlampung.id',role:'warga'},
 {id:2,name:'Petugas Pemda',email:'admin@laporlampung.id',role:'admin'}
];
const DEMO_CREDS={'warga@laporlampung.id':'Warga123!','admin@laporlampung.id':'Admin123!'};

const SEED=[
 {id:1,title:'Jalan berlubang besar di Jalan Raden Intan',category:'Jalan Rusak',district:'Enggal',location:'Jl. Raden Intan, depan Pasar Bambu Kuning',priority:'Tinggi',status:'Diproses',reporter:'Arya Warga',created:'2026-11-02',description:'Lubang diameter sekitar 60 cm membahayakan pengendara motor, terutama saat hujan dan lubang tertutup air.'},
 {id:2,title:'Lampu jalan mati total di gang perumahan',category:'Lampu Jalan',district:'Way Halim',location:'Jl. Sultan Agung, Gang Melati, Way Halim Permai',priority:'Sedang',status:'Diverifikasi',reporter:'Sari Wulandari',created:'2026-11-03',description:'Lampu jalan mati sejak lima hari, area menjadi gelap dan warga khawatir terjadi tindak kriminal.'},
 {id:3,title:'Tumpukan sampah liar di pinggir sungai',category:'Sampah & Kebersihan',district:'Panjang',location:'Bantaran sungai dekat Jl. Soekarno-Hatta, Panjang',priority:'Tinggi',status:'Baru',reporter:'Budi Santoso',created:'2026-11-04',description:'Sampah rumah tangga menumpuk dan menimbulkan bau, sebagian sampah masuk ke aliran sungai.'},
 {id:4,title:'Drainase tersumbat menyebabkan genangan',category:'Drainase & Banjir',district:'Kedaton',location:'Jl. Teuku Umar, depan pertokoan Kedaton',priority:'Darurat',status:'Diproses',reporter:'Dewi Lestari',created:'2026-11-05',description:'Setiap hujan deras air meluap ke jalan dan masuk ke toko karena drainase tersumbat lumpur dan sampah.'},
 {id:5,title:'Bangku taman rusak di Taman Kota',category:'Fasilitas Publik',district:'Tanjung Karang Pusat',location:'Taman Dipangga, Jl. Diponegoro',priority:'Rendah',status:'Selesai',reporter:'Rina Amelia',created:'2026-10-28',description:'Beberapa bangku taman patah dan besi menonjol sehingga berbahaya bagi pengunjung anak-anak.'},
 {id:6,title:'Trotoar rusak dan tidak ramah disabilitas',category:'Fasilitas Publik',district:'Rajabasa',location:'Jl. ZA Pagar Alam, dekat kampus Teknokrat',priority:'Sedang',status:'Diverifikasi',reporter:'Arya Warga',created:'2026-11-06',description:'Ubin trotoar pecah dan guiding block terputus, menyulitkan pejalan kaki dan penyandang disabilitas.'},
 {id:7,title:'Pohon tumbang menutup sebagian jalan',category:'Taman & Ruang Publik',district:'Kemiling',location:'Jl. Imam Bonjol, Kemiling',priority:'Darurat',status:'Selesai',reporter:'Agus Prasetyo',created:'2026-11-01',description:'Pohon tumbang setelah hujan angin menutup setengah badan jalan dan mengganggu lalu lintas.'},
 {id:8,title:'Air PDAM keruh di perumahan warga',category:'Air Bersih',district:'Sukarame',location:'Perumahan Korpri, Sukarame',priority:'Tinggi',status:'Baru',reporter:'Fitri Handayani',created:'2026-11-07',description:'Air berwarna keruh kecoklatan sejak dua hari, warga terpaksa membeli air isi ulang untuk memasak.'}
];
let reports=loadReports();
let session=loadSession();
let loginFails=JSON.parse(localStorage.getItem('ll_login_fails')||'{"count":0,"until":0}');
let pendingPhoto='';

function loadReports(){ try{const r=JSON.parse(localStorage.getItem('ll_reports_v12')); if(Array.isArray(r)&&r.length) return r;}catch(e){} localStorage.setItem('ll_reports_v12',JSON.stringify(SEED)); return [...SEED]; }
function saveReports(){localStorage.setItem('ll_reports_v12',JSON.stringify(reports));}
function loadSession(){ try{for(const store of [localStorage,sessionStorage]){const s=JSON.parse(store.getItem('ll_session')); if(s&&s.expiresAt>Date.now()) return s; if(s) store.removeItem('ll_session');}}catch(e){} return null; }
function setSession(user,remember){session={userId:user.id,name:user.name,email:user.email,role:user.role,expiresAt:Date.now()+SESSION_MS};(remember===false?sessionStorage:localStorage).setItem('ll_session',JSON.stringify(session));}
function clearSession(){session=null;localStorage.removeItem('ll_session');sessionStorage.removeItem('ll_session');}

function $(id){return document.getElementById(id);}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));$('view-'+view).classList.remove('hidden');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===view)); renderHeader(); if(view==='dashboard')renderDashboard(); if(view==='reports')renderReports();}
function renderHeader(){$('userBadge').textContent=session?`${session.name} (${session.role})`:'';$('loginBtn').classList.toggle('hidden',!!session);$('logoutBtn').classList.toggle('hidden',!session);
 const baru=reports.filter(r=>r.status==='Baru').length; const bb=$('bellBadge'); if(bb){bb.textContent=baru; bb.classList.toggle('hidden',baru===0);}}
function stats(){return {total:reports.length,baru:reports.filter(r=>r.status==='Baru').length,proses:reports.filter(r=>['Diverifikasi','Diproses'].includes(r.status)).length,selesai:reports.filter(r=>r.status==='Selesai').length};}
function reportCard(r){return `<article class="report"><div class="report-top"><span class="ticket">${escapeHtml(ticketId(r))}</span><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></div><h3>${escapeHtml(r.title)}</h3><div class="meta"><span class="badge cat">${escapeHtml(r.category)}</span><span class="badge ${escapeHtml(r.priority)}">Prioritas ${escapeHtml(r.priority)}</span><span>${escapeHtml(r.district)} • ${escapeHtml(r.created)}</span></div><p>${escapeHtml(r.description)}</p><p class="muted">📍 ${escapeHtml(r.location)}</p><div class="reporter"><span class="avatar" aria-hidden="true">${escapeHtml(initials(r.reporter))}</span><span class="muted">${escapeHtml(r.reporter)}</span></div><button class="btn" data-detail="${r.id}">Lihat Detail</button></article>`;}
function renderDashboard(){const s=stats();$('statsCards').innerHTML=
 `<div class="stat"><span>Total Laporan</span><strong>${s.total}</strong><small>Semua laporan warga yang tercatat</small></div>
  <div class="stat"><span>Laporan Baru</span><strong>${s.baru}</strong><small>Menunggu verifikasi petugas</small></div>
  <div class="stat"><span>Sedang Diproses</span><strong>${s.proses}</strong><small>Tindak lanjut OPD terkait</small></div>
  <div class="stat"><span>Laporan Selesai</span><strong>${s.selesai}</strong><small>Sudah selesai ditangani</small></div>`;
 $('dashChips').innerHTML='<button type="button" class="chip active" data-cat="">Semua</button>'+CATEGORIES.slice(0,5).map(c=>`<button type="button" class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
 $('dashChips').querySelectorAll('[data-cat]').forEach(ch=>ch.onclick=()=>{$('filterCategory').value=ch.dataset.cat; show('reports');});
 $('recentList').innerHTML=reports.slice().sort((a,b)=>String(b.created).localeCompare(String(a.created))).slice(0,3).map(reportCard).join('')||'<p class="muted">Belum ada laporan.</p>'; bindDetail(); renderHeader();}
function bindDetail(){document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>renderDetail(Number(b.dataset.detail)));}
const PRIO_ORDER={Darurat:0,Tinggi:1,Sedang:2,Rendah:3};
function renderReports(){const q=sanitizeText($('searchInput').value).toLowerCase(),cat=$('filterCategory').value,st=$('filterStatus').value,dist=$('filterDistrict').value,sort=$('sortSelect').value;
 let filtered=reports.filter(r=>(!cat||r.category===cat)&&(!st||r.status===st)&&(!dist||r.district===dist)&&(!q||(r.title+' '+r.location+' '+r.description+' '+ticketId(r)).toLowerCase().includes(q)));
 if(sort==='priority') filtered=filtered.slice().sort((a,b)=>(PRIO_ORDER[a.priority]??9)-(PRIO_ORDER[b.priority]??9)); else filtered=filtered.slice().sort((a,b)=>String(b.created).localeCompare(String(a.created)));
 $('resultCount').textContent=`Menampilkan ${filtered.length} dari ${reports.length} Laporan`;
 $('reportList').innerHTML=filtered.map(reportCard).join('')||'<div class="card">Tidak ada laporan yang cocok dengan filter. Coba Reset Filter.</div>'; bindDetail();}
function timelineHtml(r){
 if(r.status==='Ditolak') return `<ol class="timeline"><li class="done"><span class="tl-dot">✓</span><div class="tl-body"><strong>Laporan Diterima</strong><span>${escapeHtml(r.created)}</span></div></li><li class="rejected"><span class="tl-dot">✕</span><div class="tl-body"><strong>Laporan Ditolak</strong><span>Laporan dinilai tidak dapat ditindaklanjuti oleh petugas.</span></div></li></ol>`;
 const steps=['Baru','Diverifikasi','Diproses','Selesai']; const idx=steps.indexOf(r.status);
 const labels=[['Laporan Diterima','Laporan masuk ke sistem LaporLampung'],['Diverifikasi Petugas','Petugas memeriksa kelengkapan dan lokasi laporan'],['Diproses OPD Terkait','Dinas terkait menindaklanjuti di lapangan'],['Selesai','Penanganan selesai dan laporan ditutup']];
 return `<ol class="timeline">${labels.map((l,i)=>`<li class="${i<idx?'done':i===idx?'now':''}"><span class="tl-dot">${i<idx?'✓':i+1}</span><div class="tl-body"><strong>${l[0]}</strong><span>${l[1]}${i===0?' • '+escapeHtml(r.created):''}</span></div></li>`).join('')}</ol>`;}
function renderDetail(id){const r=reports.find(x=>x.id===id); if(!r) return; show('detail');
 const canDelete=session&&(session.role==='admin'||session.name===r.reporter);
 $('detailCard').innerHTML=`<button class="btn" id="backBtn">&larr; Kembali ke Daftar Laporan</button>
 <div class="card" style="margin-top:14px"><div class="report-top"><span class="ticket">${escapeHtml(ticketId(r))}</span><span class="muted">Kanal Pengaduan Publik</span></div>
 <h2 id="detailTitle">${escapeHtml(r.title)}</h2>
 <div class="meta"><span class="badge cat">${escapeHtml(r.category)}</span><span class="badge ${escapeHtml(r.priority)}">Prioritas: ${escapeHtml(r.priority)}</span><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></div>
 <p><strong>Lokasi:</strong> ${escapeHtml(r.location)}, ${escapeHtml(r.district)}, Bandar Lampung</p>
 <p><strong>Pelapor:</strong> ${escapeHtml(r.reporter)} • <strong>Tanggal:</strong> ${escapeHtml(r.created)}</p>
 <p>${escapeHtml(r.description)}</p>
 ${r.photo?`<img class="detail-photo" src="${r.photo}" alt="Foto bukti laporan">`:''}
 <h3>Pelacakan Penanganan</h3>${timelineHtml(r)}</div>
 ${session&&session.role==='admin'?`<div class="card admin-panel"><h3>Panel Kendali Admin</h3><label>Status Laporan <select id="statusSelect"><option ${r.status==='Baru'?'selected':''}>Baru</option><option ${r.status==='Diverifikasi'?'selected':''}>Diverifikasi</option><option ${r.status==='Diproses'?'selected':''}>Diproses</option><option ${r.status==='Selesai'?'selected':''}>Selesai</option><option ${r.status==='Ditolak'?'selected':''}>Ditolak</option></select></label><button class="btn btn-gold" id="saveStatus">Simpan Perubahan Status</button><p class="muted">Kontak darurat OPD: Hotline PUPR (0721) 481-222</p></div>`:''}
 ${canDelete?`<div class="card danger-zone"><h3>Zona Berbahaya</h3><p class="muted">Menghapus laporan bersifat permanen di perangkat ini.</p><button class="btn btn-danger" id="deleteBtn">Hapus Laporan</button></div>`:''}`;
 $('backBtn').onclick=()=>show('reports');
 const save=$('saveStatus'); if(save) save.onclick=()=>{r.status=$('statusSelect').value; saveReports(); alert('Status laporan diperbarui.'); renderDetail(id);};
 const del=$('deleteBtn'); if(del) del.onclick=()=>{ if(confirm(`Hapus laporan "${r.title}"? Tindakan ini tidak dapat dibatalkan.`)){reports=reports.filter(x=>x.id!==id); saveReports(); show('reports');}};
}
function validateReport(d){ if(d.title.length<10) return 'Judul minimal 10 karakter.'; if(d.title.length>100) return 'Judul maksimal 100 karakter.'; if(!CATEGORIES.includes(d.category)) return 'Kategori wajib dipilih.'; if(!DISTRICTS.includes(d.district)) return 'Kecamatan wajib dipilih.'; if(d.location.length<5) return 'Lokasi detail minimal 5 karakter.'; if(!['Rendah','Sedang','Tinggi','Darurat'].includes(d.priority)) return 'Prioritas wajib dipilih.'; if(d.description.length<20) return 'Deskripsi minimal 20 karakter.'; if(d.description.length>500) return 'Deskripsi maksimal 500 karakter.'; return ''; }

function goCreate(){ if(!session){show('login'); $('loginError').textContent='Silakan masuk sebagai warga atau admin untuk membuat laporan.'; return;} show('create'); }
function init(){
 // Logos: exact files supplied by the project owner, embedded in index.html.
 // Login-card logos reuse the same embedded images.
 const lp=document.getElementById('logoPemda'), lpl=document.getElementById('logoPemdaLogin');
 if(lp&&lpl) lpl.src=lp.src;
 const lt=document.getElementById('logoTeknokrat'), ltl=document.getElementById('logoTeknokratLogin');
 if(lt&&ltl) ltl.src=lt.src;
 CATEGORIES.forEach(c=>{$('filterCategory').insertAdjacentHTML('beforeend',`<option>${escapeHtml(c)}</option>`);$('fCategory').insertAdjacentHTML('beforeend',`<option>${escapeHtml(c)}</option>`);});
 DISTRICTS.forEach(d=>{$('filterDistrict').insertAdjacentHTML('beforeend',`<option>${escapeHtml(d)}</option>`);$('fDistrict').insertAdjacentHTML('beforeend',`<option>${escapeHtml(d)}</option>`);});
 document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{ if(b.dataset.nav==='create'){goCreate(); return;} show(b.dataset.nav);});
 $('heroCreate').onclick=goCreate; $('reportsCreate').onclick=goCreate; $('seeAll').onclick=()=>show('reports');
 $('bellBtn').onclick=()=>{$('filterStatus').value='Baru'; show('reports');};
 $('trackForm').addEventListener('submit',e=>{e.preventDefault(); $('searchInput').value=$('trackInput').value; show('reports');});
 $('loginBtn').onclick=()=>show('login'); $('cancelLogin').onclick=()=>show('dashboard');
 $('logoutBtn').onclick=()=>{clearSession(); show('dashboard');};
 $('togglePassword').onclick=()=>{const p=$('loginPassword'); const showPw=p.type==='password'; p.type=showPw?'text':'password'; $('togglePassword').textContent=showPw?'Sembunyi':'Lihat';};
 ['searchInput','filterCategory','filterStatus','filterDistrict','sortSelect'].forEach(id=>$(id).addEventListener('input',renderReports));
 document.querySelectorAll('.chip-topic').forEach(ch=>ch.onclick=()=>{$('searchInput').value=ch.dataset.q; renderReports();});
 $('resetFilter').onclick=()=>{$('searchInput').value='';$('filterCategory').value='';$('filterStatus').value='';$('filterDistrict').value='';$('sortSelect').value='new'; renderReports();};
 $('fTitle').addEventListener('input',()=>$('titleCount').textContent=$('fTitle').value.length);
 $('fDescription').addEventListener('input',()=>$('descCount').textContent=$('fDescription').value.length);
 $('fPhoto').addEventListener('change',()=>{const f=$('fPhoto').files[0]; pendingPhoto=''; if(!f){$('photoName').textContent='Belum ada foto dipilih.'; return;}
   if(!['image/jpeg','image/png'].includes(f.type)){$('photoName').textContent='Format foto harus JPG atau PNG.'; $('fPhoto').value=''; return;}
   if(f.size>2*1024*1024){$('photoName').textContent='Ukuran foto melebihi 2 MB.'; $('fPhoto').value=''; return;}
   const rd=new FileReader(); rd.onload=()=>{pendingPhoto=String(rd.result); $('photoName').textContent='Foto terpilih: '+f.name;}; rd.readAsDataURL(f);});
 $('reportForm').addEventListener('submit',e=>{e.preventDefault(); if(!session){show('login'); return;}
   const d={title:sanitizeText($('fTitle').value),category:$('fCategory').value,district:$('fDistrict').value,location:sanitizeText($('fLocation').value),priority:$('fPriority').value,description:sanitizeText($('fDescription').value)};
   let err=validateReport(d); if(!err&&!$('fTruth').checked) err='Centang pernyataan kebenaran laporan terlebih dahulu.';
   $('formError').textContent=err; if(err) return;
   reports.unshift({id:Date.now(),...d,status:'Baru',reporter:session.name,created:new Date().toISOString().slice(0,10),photo:pendingPhoto||undefined}); saveReports(); pendingPhoto=''; e.target.reset(); $('titleCount').textContent='0'; $('descCount').textContent='0'; $('photoName').textContent='Belum ada foto dipilih.'; alert('Laporan berhasil dikirim dengan status Baru.'); show('reports');});
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();
   if(Date.now()<loginFails.until){$('loginError').textContent='Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.'; return;}
   const email=sanitizeText($('loginEmail').value).toLowerCase(), pass=$('loginPassword').value;
   if(!isValidEmail(email)){$('loginError').textContent='Format email tidak valid.'; return;}
   if(pass.length<8){$('loginError').textContent='Kata sandi minimal 8 karakter.'; return;}
   const user=USERS.find(u=>u.email===email);
   if(!user||DEMO_CREDS[email]!==pass){loginFails.count++; if(loginFails.count>=MAX_LOGIN_FAIL){loginFails.until=Date.now()+LOCK_MS; loginFails.count=0;} localStorage.setItem('ll_login_fails',JSON.stringify(loginFails)); $('loginError').textContent='Email atau kata sandi salah.'; $('loginAttempts').textContent=`Percobaan gagal tercatat. Akun dikunci sementara setelah ${MAX_LOGIN_FAIL} kali gagal.`; return;}
   loginFails={count:0,until:0}; localStorage.setItem('ll_login_fails',JSON.stringify(loginFails)); setSession(user,$('rememberMe').checked); show('dashboard');});
 renderHeader(); renderDashboard();
}
document.addEventListener('DOMContentLoaded',init);
if(typeof module!=='undefined'){module.exports={escapeHtml,sanitizeText,isValidEmail,validateReport,CATEGORIES,DISTRICTS};}
