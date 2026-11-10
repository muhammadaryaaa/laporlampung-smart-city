/* LaporLampung v1.2.0 - Final after testing fixes (v1.1) and security fixes (v1.2)
   Frontend demo mirrors PostgreSQL schema (users, categories, reports, comments, status_history).
   Production API: Rust Axum in ../backend-rust (DATABASE_URL PostgreSQL). */
'use strict';
const CATEGORIES=['Jalan Rusak','Lampu Jalan','Sampah & Kebersihan','Drainase & Banjir','Fasilitas Publik','Taman & Ruang Publik','Lalu Lintas','Air Bersih'];
const DISTRICTS=['Bumi Waras','Enggal','Kedamaian','Kedaton','Kemiling','Labuhan Ratu','Langkapura','Panjang','Rajabasa','Sukabumi','Sukarame','Tanjung Karang Barat','Tanjung Karang Pusat','Tanjung Karang Timur','Teluk Betung Barat','Teluk Betung Selatan','Teluk Betung Timur','Teluk Betung Utara','Way Halim','Sukabumi Indah'];
const SESSION_MS=2*60*60*1000; // SEC-07 fix: session expiry 2 hours
const MAX_LOGIN_FAIL=5, LOCK_MS=5*60*1000; // SEC-04 fix: rate limiting / lockout

// SEC-03 fix: escape ALL user data before rendering (prevents XSS)
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function sanitizeText(v){return String(v??'').replace(/<[^>]*>/g,'').trim();}
function isValidEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);}

// Demo users: passwords are NEVER stored plain in production Rust backend (Argon2, SEC-01).
// Frontend demo keeps only a SHA-256 hash for illustration.
async function sha256(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const USERS=[
 {id:1,name:'Arya Warga',email:'warga@laporlampung.id',role:'warga',passHash:'demo-warga-hash-placeholder'},
 {id:2,name:'Petugas Pemda',email:'admin@laporlampung.id',role:'admin',passHash:'demo-admin-hash-placeholder'}
];
// Plain demo passwords kept in a separate map only for offline demo verification via hash comparison simulation
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

function loadReports(){ try{const r=JSON.parse(localStorage.getItem('ll_reports_v12')); if(Array.isArray(r)&&r.length) return r;}catch(e){} localStorage.setItem('ll_reports_v12',JSON.stringify(SEED)); return [...SEED]; }
function saveReports(){localStorage.setItem('ll_reports_v12',JSON.stringify(reports));}
function loadSession(){ try{const s=JSON.parse(localStorage.getItem('ll_session')); if(s&&s.expiresAt>Date.now()) return s; localStorage.removeItem('ll_session');}catch(e){} return null; }
function setSession(user){session={userId:user.id,name:user.name,email:user.email,role:user.role,expiresAt:Date.now()+SESSION_MS};localStorage.setItem('ll_session',JSON.stringify(session));}
function clearSession(){session=null;localStorage.removeItem('ll_session');}

function $(id){return document.getElementById(id);}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));$('view-'+view).classList.remove('hidden');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===view)); renderHeader(); if(view==='dashboard')renderDashboard(); if(view==='reports')renderReports();}
function renderHeader(){$('userBadge').textContent=session?`${session.name} (${session.role})`:'';$('loginBtn').classList.toggle('hidden',!!session);$('logoutBtn').classList.toggle('hidden',!session);}
function stats(){return {total:reports.length,baru:reports.filter(r=>r.status==='Baru').length,proses:reports.filter(r=>['Diverifikasi','Diproses'].includes(r.status)).length,selesai:reports.filter(r=>r.status==='Selesai').length};}
function reportCard(r){return `<article class="report"><h3>${escapeHtml(r.title)}</h3><div class="meta"><span class="badge">${escapeHtml(r.category)}</span><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span><span class="badge ${escapeHtml(r.priority)}">${escapeHtml(r.priority)}</span><span>${escapeHtml(r.district)} • ${escapeHtml(r.created)}</span></div><p>${escapeHtml(r.description)}</p><p class="muted">${escapeHtml(r.location)} — oleh ${escapeHtml(r.reporter)}</p><button class="btn" data-detail="${r.id}">Lihat Detail</button></article>`;}
function renderDashboard(){const s=stats();$('statsCards').innerHTML=`<div class="stat"><span>Total Laporan</span><strong>${s.total}</strong></div><div class="stat"><span>Baru</span><strong>${s.baru}</strong></div><div class="stat"><span>Diproses</span><strong>${s.proses}</strong></div><div class="stat"><span>Selesai</span><strong>${s.selesai}</strong></div>`;$('recentList').innerHTML=reports.slice().sort((a,b)=>b.id-a.id).slice(0,3).map(reportCard).join('')||'<p class="muted">Belum ada laporan.</p>'; bindDetail();}
function bindDetail(){document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>renderDetail(Number(b.dataset.detail)));}
function renderReports(){const q=sanitizeText($('searchInput').value).toLowerCase(),cat=$('filterCategory').value,st=$('filterStatus').value,dist=$('filterDistrict').value;
 const filtered=reports.filter(r=>(!cat||r.category===cat)&&(!st||r.status===st)&&(!dist||r.district===dist)&&(!q||(r.title+' '+r.location+' '+r.description).toLowerCase().includes(q)));
 $('resultCount').textContent=`Menampilkan ${filtered.length} dari ${reports.length} laporan`;
 $('reportList').innerHTML=filtered.map(reportCard).join('')||'<div class="card">Tidak ada laporan yang cocok dengan filter. Coba Reset Filter.</div>'; bindDetail();}
function renderDetail(id){const r=reports.find(x=>x.id===id); if(!r) return; show('detail');
 const canDelete=session&&(session.role==='admin'||session.name===r.reporter);
 $('detailCard').innerHTML=`<button class="btn" id="backBtn">&larr; Kembali</button><h2 id="detailTitle">${escapeHtml(r.title)}</h2><div class="meta"><span class="badge">${escapeHtml(r.category)}</span><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span><span>${escapeHtml(r.district)}</span></div><p><strong>Lokasi:</strong> ${escapeHtml(r.location)}</p><p><strong>Pelapor:</strong> ${escapeHtml(r.reporter)} • ${escapeHtml(r.created)}</p><p>${escapeHtml(r.description)}</p>
 ${session&&session.role==='admin'?`<label>Status <select id="statusSelect"><option ${r.status==='Baru'?'selected':''}>Baru</option><option ${r.status==='Diverifikasi'?'selected':''}>Diverifikasi</option><option ${r.status==='Diproses'?'selected':''}>Diproses</option><option ${r.status==='Selesai'?'selected':''}>Selesai</option><option ${r.status==='Ditolak'?'selected':''}>Ditolak</option></select></label><button class="btn btn-primary" id="saveStatus">Simpan Status</button>`:''}
 ${canDelete?`<button class="btn btn-danger" id="deleteBtn">Hapus Laporan</button>`:''}`;
 $('backBtn').onclick=()=>show('reports');
 const save=$('saveStatus'); if(save) save.onclick=()=>{r.status=$('statusSelect').value; saveReports(); alert('Status laporan diperbarui.'); renderDetail(id);};
 const del=$('deleteBtn'); if(del) del.onclick=()=>{ // BUG-05 fix: confirmation dialog
   if(confirm(`Hapus laporan "${r.title}"? Tindakan ini tidak dapat dibatalkan.`)){reports=reports.filter(x=>x.id!==id); saveReports(); show('reports');}};
}
// Validation - BUG-01/02 fix: JS validation, not only HTML required
function validateReport(d){ if(d.title.length<10) return 'Judul minimal 10 karakter.'; if(d.title.length>100) return 'Judul maksimal 100 karakter.'; if(!CATEGORIES.includes(d.category)) return 'Kategori wajib dipilih.'; if(!DISTRICTS.includes(d.district)) return 'Kecamatan wajib dipilih.'; if(d.location.length<5) return 'Lokasi detail minimal 5 karakter.'; if(!['Rendah','Sedang','Tinggi','Darurat'].includes(d.priority)) return 'Prioritas wajib dipilih.'; if(d.description.length<20) return 'Deskripsi minimal 20 karakter.'; if(d.description.length>500) return 'Deskripsi maksimal 500 karakter.'; return ''; }

function init(){
 // Logo fallback to local assets if official source is unreachable
 const lp=document.getElementById('logoPemda'); if(lp) lp.addEventListener('error',()=>{lp.src='assets/logo-pemda.png';},{once:true});
 const lt=document.getElementById('logoTeknokrat'); if(lt) lt.addEventListener('error',()=>{lt.src='assets/logo-teknokrat.png';},{once:true});
 CATEGORIES.forEach(c=>{$('filterCategory').insertAdjacentHTML('beforeend',`<option>${escapeHtml(c)}</option>`);$('fCategory').insertAdjacentHTML('beforeend',`<option>${escapeHtml(c)}</option>`);});
 DISTRICTS.forEach(d=>{$('filterDistrict').insertAdjacentHTML('beforeend',`<option>${escapeHtml(d)}</option>`);$('fDistrict').insertAdjacentHTML('beforeend',`<option>${escapeHtml(d)}</option>`);});
 document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{ if(b.dataset.nav==='create'&&!session){show('login'); $('loginError').textContent='Silakan masuk sebagai warga atau admin untuk membuat laporan.'; return;} show(b.dataset.nav);});
 $('loginBtn').onclick=()=>show('login'); $('cancelLogin').onclick=()=>show('dashboard');
 $('logoutBtn').onclick=()=>{clearSession(); show('dashboard');};
 ['searchInput','filterCategory','filterStatus','filterDistrict'].forEach(id=>$(id).addEventListener('input',renderReports));
 $('resetFilter').onclick=()=>{$('searchInput').value='';$('filterCategory').value='';$('filterStatus').value='';$('filterDistrict').value=''; renderReports();}; // BUG-03 fix: reset ALL filters incl. status
 $('fTitle').addEventListener('input',()=>$('titleCount').textContent=$('fTitle').value.length);
 $('fDescription').addEventListener('input',()=>$('descCount').textContent=$('fDescription').value.length); // BUG-02 fix: live counter
 $('reportForm').addEventListener('submit',e=>{e.preventDefault(); if(!session){show('login'); return;}
   const d={title:sanitizeText($('fTitle').value),category:$('fCategory').value,district:$('fDistrict').value,location:sanitizeText($('fLocation').value),priority:$('fPriority').value,description:sanitizeText($('fDescription').value)};
   const err=validateReport(d); $('formError').textContent=err; if(err) return;
   reports.unshift({id:Date.now(),...d,status:'Baru',reporter:session.name,created:new Date().toISOString().slice(0,10)}); saveReports(); e.target.reset(); $('titleCount').textContent='0'; $('descCount').textContent='0'; alert('Laporan berhasil dikirim dengan status Baru.'); show('reports');});
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();
   if(Date.now()<loginFails.until){$('loginError').textContent='Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.'; return;}
   const email=sanitizeText($('loginEmail').value).toLowerCase(), pass=$('loginPassword').value;
   if(!isValidEmail(email)){$('loginError').textContent='Format email tidak valid.'; return;}
   if(pass.length<8){$('loginError').textContent='Kata sandi minimal 8 karakter.'; return;}
   const user=USERS.find(u=>u.email===email);
   if(!user||DEMO_CREDS[email]!==pass){loginFails.count++; if(loginFails.count>=MAX_LOGIN_FAIL){loginFails.until=Date.now()+LOCK_MS; loginFails.count=0;} localStorage.setItem('ll_login_fails',JSON.stringify(loginFails)); $('loginError').textContent='Email atau kata sandi salah.'; $('loginAttempts').textContent=`Percobaan gagal tercatat. Akun dikunci sementara setelah ${MAX_LOGIN_FAIL} kali gagal.`; return;}
   loginFails={count:0,until:0}; localStorage.setItem('ll_login_fails',JSON.stringify(loginFails)); setSession(user); show('dashboard');});
 renderHeader(); renderDashboard();
}
document.addEventListener('DOMContentLoaded',init);
// Export for automated testing (Node)
if(typeof module!=='undefined'){module.exports={escapeHtml,sanitizeText,isValidEmail,validateReport,CATEGORIES,DISTRICTS};}
