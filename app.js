/* ============================================
   AUTOVENDA PRO v3.0
   ============================================ */

// ====== CONFIG ======
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxYaxNe6BkMzCBpiXKdvPDUudqG0O5tRVC-VcJ6Ehx_pkSXcS2qtiK5q2C5p1FiOLI/exec';
const LOGIN_USER = 'celso';
const LOGIN_PASS = 'L@isa0108';
const CACHE_MIN = 5;
const PAGE_SIZE = 30;

// Temperature thresholds (days since last contact)
const TEMP_HOT_DAYS = 3;
const TEMP_WARM_DAYS = 14;
// > 14 = cold; never contacted = none

// ====== STATE ======
let clients = [];
let agenda = [];
let currentPage = 'home';
let currentTempFilter = 'all';
let currentClientId = null;
let currentAgendaDate = null;
let clientPageOffset = 0;
let importBuffer = [];

// ====== UTILS ======
function today() { return new Date().toISOString().slice(0,10); }
function now() { return new Date().toISOString(); }
function uid() { return 'c_' + Date.now() + '_' + Math.floor(Math.random()*9999); }

function $(id) { return document.getElementById(id); }

function showToast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => t.classList.remove('show'), 2500);
}

function formatDate(d) {
  if (!d) return '--';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0,10);
    return dt.toLocaleDateString('pt-BR');
  } catch { return String(d).slice(0,10); }
}

function formatDateTime(d) {
  if (!d) return '--';
  try {
    const dt = new Date(d);
    return dt.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  } catch { return String(d); }
}

function daysSince(dateStr) {
  if (!dateStr) return -1;
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return -1;
    const ms = Date.now() - d.getTime();
    return Math.floor(ms / 86400000);
  } catch { return -1; }
}

function getTemp(c) {
  const last = c.lastContact;
  if (!last) return 'none';
  const days = daysSince(last);
  if (days < 0) return 'none';
  if (days <= TEMP_HOT_DAYS) return 'hot';
  if (days <= TEMP_WARM_DAYS) return 'warm';
  return 'cold';
}

function tempLabel(t) {
  return { hot:'Quente', warm:'Morno', cold:'Frio', none:'Sem contato' }[t] || 'Sem contato';
}

function tempBadge(t) {
  const icon = { hot:'🔥', warm:'☀️', cold:'❄️', none:'•' }[t];
  return `<span class="temp-badge ${t}">${icon} ${tempLabel(t)}</span>`;
}

function lastContactLabel(c) {
  if (!c.lastContact) return 'Nunca contatado';
  const days = daysSince(c.lastContact);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days} dias atrás`;
  if (days < 30) return `${Math.floor(days/7)} sem. atrás`;
  if (days < 365) return `${Math.floor(days/30)} meses atrás`;
  return `${Math.floor(days/365)} ano(s) atrás`;
}

function avatarColor(name) {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#98D8C8','#F7B731','#A29BFE','#FD79A8','#00B894','#E17055'];
  const sum = String(name||'?').split('').reduce((s,c) => s + c.charCodeAt(0), 0);
  return colors[sum % colors.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

function cleanPhone(p) { return String(p||'').replace(/\D/g,''); }

function copyText(text) {
  if (!text || text === '--') return;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copiado!')).catch(() => {});
}

// ====== LOGIN ======
function doLogin() {
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  if (u === LOGIN_USER && p === LOGIN_PASS) {
    localStorage.setItem('crm_auth', '1');
    $('loginScreen').style.display = 'none';
    $('app').style.display = 'flex';
    initApp();
  } else {
    $('loginError').textContent = 'Usuário ou senha inválidos.';
  }
}

function doLogout() {
  if (!confirm('Sair do sistema?')) return;
  localStorage.removeItem('crm_auth');
  location.reload();
}

// ====== STORAGE ======
function loadFromCache() {
  try {
    clients = JSON.parse(localStorage.getItem('crm_clients') || '[]');
    agenda = JSON.parse(localStorage.getItem('crm_agenda') || '[]');
  } catch { clients = []; agenda = []; }
}

function saveToCache() {
  if (clients.length > 0) {
    localStorage.setItem('crm_clients', JSON.stringify(clients));
  }
  localStorage.setItem('crm_agenda', JSON.stringify(agenda));
}

// ====== SHEETS SYNC ======
async function loadFromSheets() {
  if (!SHEETS_URL) return false;
  try {
    const res = await fetch(SHEETS_URL + '?action=getAll&t=' + Date.now(), { redirect: 'follow' });
    const json = await res.json();
    if (json.status === 'ok' && Array.isArray(json.clients)) {
      // Só sobrescreve se vier dados
      if (json.clients.length > 0) {
        clients = json.clients.map(normalizeClient);
      }
      if (Array.isArray(json.agenda)) {
        agenda = json.agenda.map(normalizeAgenda);
      }
      saveToCache();
      localStorage.setItem('lastSync', Date.now().toString());
      return true;
    }
    // Fallback to legacy clients-only endpoint
    if (json.status === 'ok' && json.clients) {
      if (json.clients.length > 0) {
        clients = json.clients.map(normalizeClient);
        saveToCache();
        localStorage.setItem('lastSync', Date.now().toString());
      }
      return true;
    }
  } catch(e) {
    console.warn('Erro ao buscar do Sheets:', e);
  }
  return false;
}

function normalizeClient(c, i) {
  if (!c.id) c.id = 'c_' + (i || Date.now());
  c.id = String(c.id).trim();
  if (typeof c.history === 'string') {
    try { c.history = JSON.parse(c.history); } catch { c.history = []; }
  }
  if (!Array.isArray(c.history)) c.history = [];
  c.nome = String(c.nome || c.contato || c.empresa || 'Cliente').trim();
  c.empresa = String(c.empresa || '').trim();
  c.telefone = String(c.telefone || c.whatsapp || '').trim();
  c.email = String(c.email || '').trim();
  c.cnpj = String(c.cnpj || '').trim();
  c.cidade = String(c.cidade || '').trim();
  c.obs = String(c.obs || '').trim();
  c.lastContact = c.lastContact || '';
  c.createdAt = c.createdAt || today();
  return c;
}

function normalizeAgenda(a, i) {
  if (!a.id) a.id = 'a_' + (i || Date.now());
  a.id = String(a.id).trim();
  a.clientId = String(a.clientId || '').trim();
  a.clientName = String(a.clientName || '').trim();
  a.date = String(a.date || today()).slice(0,10);
  a.time = String(a.time || '').slice(0,5);
  a.obs = String(a.obs || '').trim();
  a.done = !!a.done;
  return a;
}

async function syncToSheets() {
  if (!SHEETS_URL || clients.length === 0) return false;
  try {
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveAll', clients, agenda })
    });
    const json = await res.json();
    if (json.status === 'ok') {
      localStorage.setItem('lastSync', Date.now().toString());
      return true;
    }
  } catch(e) { console.warn('Erro ao sincronizar:', e); }
  return false;
}

async function forceSyncToSheets() {
  const status = $('syncStatus');
  if (!clients.length) {
    if (status) status.textContent = '⚠️ Nenhum cliente local.';
    showToast('⚠️ Nada para sincronizar', 'error');
    return;
  }
  if (status) status.textContent = '🔄 Enviando ' + clients.length + ' clientes...';
  showToast('🔄 Sincronizando...');
  const ok = await syncToSheets();
  if (ok) {
    if (status) status.textContent = '✅ ' + clients.length + ' clientes salvos no Sheets!';
    showToast('✅ Backup feito!');
    updateLastSyncLabel();
  } else {
    if (status) status.textContent = '❌ Erro ao sincronizar.';
    showToast('❌ Erro', 'error');
  }
}

async function syncData() {
  const btn = $('syncBtn');
  if (btn) btn.textContent = '⏳';
  showToast('🔄 Sincronizando...');
  const ok = await loadFromSheets();
  if (btn) btn.textContent = '🔄';
  if (ok) {
    renderAll();
    updateLastSyncLabel();
    showToast('✅ Sincronizado!');
  } else {
    showToast('⚠️ Sem conexão com Sheets', 'error');
  }
}

function updateLastSyncLabel() {
  const ts = localStorage.getItem('lastSync');
  const el = $('lastSyncText');
  if (!el) return;
  if (!ts) {
    el.textContent = 'Nunca sincronizado';
    return;
  }
  el.textContent = 'Última: ' + formatDateTime(parseInt(ts));
}

// ====== NAVIGATION ======
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = $('page-' + page);
  if (target) target.classList.add('active');
  
  document.querySelectorAll('.bn-item, .nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
    else if (n.dataset.page) n.classList.remove('active');
  });

  window.scrollTo(0, 0);

  if (page === 'home') renderHome();
  if (page === 'clients') { clientPageOffset = 0; renderClients(); }
  if (page === 'agenda') renderAgenda();
  if (page === 'reports') renderReports();
  if (page === 'more') updateLastSyncLabel();
}

function toggleMenu() { navigate('more'); }

// ====== HOME ======
function renderHome() {
  const hour = new Date().getHours();
  let greet = 'Boa noite';
  if (hour < 12) greet = 'Bom dia';
  else if (hour < 18) greet = 'Boa tarde';
  $('greetingText').textContent = greet + ', Celso! 👋';
  
  const hot = clients.filter(c => getTemp(c) === 'hot').length;
  const warm = clients.filter(c => getTemp(c) === 'warm').length;
  const cold = clients.filter(c => getTemp(c) === 'cold').length;
  
  $('homeHotCount').textContent = hot;
  $('homeWarmCount').textContent = warm;
  $('homeColdCount').textContent = cold;

  // Próximos para contato — prioriza warm e cold (não falados há mais tempo)
  const priority = clients
    .filter(c => c.telefone)
    .sort((a,b) => {
      const ta = getTemp(a), tb = getTemp(b);
      const order = { hot:0, warm:1, cold:2, none:3 };
      if (order[ta] !== order[tb]) return order[ta] - order[tb];
      // Dentro do mesmo grupo, mais antigo primeiro
      return daysSince(b.lastContact) - daysSince(a.lastContact);
    })
    .slice(0, 6);
  
  $('homeClientList').innerHTML = priority.map(clientCardHTML).join('') || '<p style="color:var(--text2);text-align:center;padding:2rem 0">Nenhum cliente ainda</p>';
}

function filterByTemp(temp) {
  currentTempFilter = temp;
  navigate('clients');
  // Set filter UI after render
  setTimeout(() => setTempFilter(temp), 50);
}

// ====== CLIENTS ======
function setTempFilter(temp) {
  currentTempFilter = temp;
  document.querySelectorAll('.temp-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.temp === temp);
  });
  clientPageOffset = 0;
  renderClients();
}

function getFilteredClients() {
  const q = ($('searchInput')?.value || '').toLowerCase().trim();
  let list = clients;
  
  if (currentTempFilter !== 'all') {
    list = list.filter(c => getTemp(c) === currentTempFilter);
  }
  
  if (q) {
    list = list.filter(c => 
      (c.nome || '').toLowerCase().includes(q) ||
      (c.empresa || '').toLowerCase().includes(q) ||
      cleanPhone(c.telefone).includes(cleanPhone(q))
    );
  }
  
  // Sort: most recently contacted first, then never contacted
  list.sort((a,b) => {
    if (!a.lastContact && !b.lastContact) return (a.nome||'').localeCompare(b.nome||'');
    if (!a.lastContact) return 1;
    if (!b.lastContact) return -1;
    return new Date(b.lastContact) - new Date(a.lastContact);
  });
  
  return list;
}

function renderClients() {
  const all = getFilteredClients();
  const showing = all.slice(0, clientPageOffset + PAGE_SIZE);
  
  $('clientCount').textContent = all.length + ' cliente(s)';
  $('clientList').innerHTML = showing.map(clientCardHTML).join('') || '<p style="color:var(--text2);text-align:center;padding:2rem 0">Nenhum cliente encontrado</p>';
  
  $('loadMoreBox').style.display = (showing.length < all.length) ? 'flex' : 'none';
}

function loadMoreClients() {
  clientPageOffset += PAGE_SIZE;
  renderClients();
}

function clientCardHTML(c) {
  const temp = getTemp(c);
  const name = c.nome || c.empresa || 'Cliente';
  const color = avatarColor(name);
  return `
    <div class="client-card ${temp}" onclick="openClientDetail('${c.id}')">
      <div class="avatar" style="background:${color}">${initials(name)}</div>
      <div class="client-info">
        <div class="client-name">${name}</div>
        ${c.empresa ? `<div class="client-company">${c.empresa}</div>` : ''}
        <div class="client-last">${lastContactLabel(c)}</div>
      </div>
      <div class="client-right">
        ${tempBadge(temp)}
        ${c.telefone ? `<button class="btn-wpp" onclick="event.stopPropagation();openWhatsApp('${cleanPhone(c.telefone)}')">💬</button>` : ''}
      </div>
    </div>
  `;
}

function openWhatsApp(phone) {
  if (!phone) return;
  const clean = cleanPhone(phone);
  if (!clean) { showToast('⚠️ Telefone inválido', 'error'); return; }
  window.open('https://wa.me/' + clean, '_blank');
}

function toggleFilters() {
  // Future: sort, advanced filter
  showToast('💡 Use os filtros acima');
}

// ====== CLIENT DETAIL ======
function openClientDetail(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  currentClientId = id;
  
  const name = c.nome || c.empresa || 'Cliente';
  const temp = getTemp(c);
  const color = avatarColor(name);
  
  const avatar = $('detailAvatar');
  avatar.textContent = initials(name);
  avatar.style.background = color;
  
  $('detailName').textContent = name;
  $('detailCompany').textContent = c.empresa || '';
  $('detailTemp').innerHTML = tempBadge(temp);
  
  $('detailPhone').textContent = c.telefone || '--';
  $('detailEmail').textContent = c.email || '--';
  $('detailLocation').textContent = c.cidade || '--';
  $('detailCnpj').textContent = c.cnpj || '--';
  
  $('detailPhoneRow').style.display = c.telefone ? 'flex' : 'none';
  $('detailEmailRow').style.display = c.email ? 'flex' : 'none';
  $('detailLocationRow').style.display = c.cidade ? 'flex' : 'none';
  $('detailCnpjRow').style.display = c.cnpj ? 'flex' : 'none';
  
  if (c.lastContact) {
    $('detailLastContact').textContent = formatDateTime(c.lastContact);
    const lastHist = (c.history || [])[0];
    $('detailLastObs').textContent = lastHist ? lastHist.text || '' : '';
  } else {
    $('detailLastContact').textContent = 'Nunca contatado';
    $('detailLastObs').textContent = '';
  }
  
  $('detailObs').textContent = c.obs || '--';
  
  const hist = c.history || [];
  $('detailHistory').innerHTML = hist.length 
    ? hist.slice(0, 20).map(h => `
        <div class="history-item ${h.type || 'note'}">
          <div class="h-date">${formatDateTime(h.date)}</div>
          <div class="h-text">${h.text || h.label || '--'}</div>
        </div>
      `).join('')
    : '<p style="color:var(--text2);text-align:center;padding:1rem 0">Nenhum contato registrado</p>';
  
  navigate('client-detail');
}

function openWhatsAppCurrent() {
  const c = clients.find(x => x.id === currentClientId);
  if (c && c.telefone) {
    openWhatsApp(c.telefone);
    // Register contact silently
    setTimeout(() => addQuickContact('whatsapp', 'Conversa iniciada via WhatsApp'), 800);
  }
}

function callClient() {
  const c = clients.find(x => x.id === currentClientId);
  if (!c || !c.telefone) { showToast('⚠️ Sem telefone', 'error'); return; }
  window.location.href = 'tel:+' + cleanPhone(c.telefone);
  setTimeout(() => addQuickContact('call', 'Ligação realizada'), 800);
}

function addQuickContact(type, text) {
  const c = clients.find(x => x.id === currentClientId);
  if (!c) return;
  c.lastContact = now();
  if (!c.history) c.history = [];
  c.history.unshift({ type, date: now(), text });
  if (c.history.length > 50) c.history = c.history.slice(0, 50);
  saveToCache();
  syncToSheets();
}

// ====== NOTES ======
function openNoteModal() {
  $('noteText').value = '';
  $('noteType').value = 'whatsapp';
  $('noteModal').classList.add('show');
}
function closeNoteModal() { $('noteModal').classList.remove('show'); }

function saveNote() {
  const text = $('noteText').value.trim();
  const type = $('noteType').value;
  if (!text) { showToast('⚠️ Escreva uma anotação', 'error'); return; }
  const c = clients.find(x => x.id === currentClientId);
  if (!c) return;
  c.lastContact = now();
  if (!c.history) c.history = [];
  c.history.unshift({ type, date: now(), text });
  if (c.history.length > 50) c.history = c.history.slice(0, 50);
  saveToCache();
  syncToSheets();
  closeNoteModal();
  openClientDetail(currentClientId);
  showToast('✅ Anotação salva!');
}

// ====== NEW/EDIT CLIENT ======
function openNewClientModal() {
  $('m_id').value = '';
  $('m_nome').value = '';
  $('m_empresa').value = '';
  $('m_telefone').value = '';
  $('m_email').value = '';
  $('m_cnpj').value = '';
  $('m_cidade').value = '';
  $('m_obs').value = '';
  $('clientModalTitle').textContent = 'Novo Cliente';
  $('deleteClientBtn').style.display = 'none';
  $('clientModal').classList.add('show');
}

function openEditClient() {
  const c = clients.find(x => x.id === currentClientId);
  if (!c) return;
  $('m_id').value = c.id;
  $('m_nome').value = c.nome || '';
  $('m_empresa').value = c.empresa || '';
  $('m_telefone').value = c.telefone || '';
  $('m_email').value = c.email || '';
  $('m_cnpj').value = c.cnpj || '';
  $('m_cidade').value = c.cidade || '';
  $('m_obs').value = c.obs || '';
  $('clientModalTitle').textContent = 'Editar Cliente';
  $('deleteClientBtn').style.display = 'inline-flex';
  $('clientModal').classList.add('show');
}

function closeClientModal() { $('clientModal').classList.remove('show'); }

function saveClientForm() {
  const nome = $('m_nome').value.trim();
  const telefone = $('m_telefone').value.trim();
  if (!nome) { showToast('⚠️ Nome obrigatório', 'error'); return; }
  if (!telefone) { showToast('⚠️ Telefone obrigatório', 'error'); return; }
  
  const id = $('m_id').value;
  const data = {
    nome,
    empresa: $('m_empresa').value.trim(),
    telefone,
    email: $('m_email').value.trim(),
    cnpj: $('m_cnpj').value.trim(),
    cidade: $('m_cidade').value.trim(),
    obs: $('m_obs').value.trim()
  };
  
  if (id) {
    const c = clients.find(x => x.id === id);
    Object.assign(c, data);
  } else {
    const newClient = {
      id: uid(),
      ...data,
      lastContact: '',
      createdAt: today(),
      history: []
    };
    clients.unshift(newClient);
    currentClientId = newClient.id;
  }
  
  saveToCache();
  syncToSheets();
  closeClientModal();
  
  if (id) openClientDetail(id);
  else { navigate('clients'); }
  showToast('✅ Cliente salvo!');
}

function deleteClient() {
  const id = $('m_id').value;
  if (!id) return;
  if (!confirm('Excluir esse cliente? Esta ação não pode ser desfeita.')) return;
  clients = clients.filter(c => c.id !== id);
  saveToCache();
  syncToSheets();
  closeClientModal();
  navigate('clients');
  showToast('🗑️ Cliente excluído');
}

function quickWhatsAppFromForm() {
  const phone = $('m_telefone').value.trim();
  if (!phone) { showToast('⚠️ Digite o telefone primeiro', 'error'); return; }
  openWhatsApp(phone);
}

// ====== AGENDA ======
function renderAgenda() {
  if (!currentAgendaDate) currentAgendaDate = today();
  renderWeekStrip();
  renderAgendaList();
}

function renderWeekStrip() {
  const today_d = new Date();
  today_d.setHours(0,0,0,0);
  const day = today_d.getDay(); // 0 = Sun
  const monday = new Date(today_d);
  monday.setDate(today_d.getDate() - (day === 0 ? 6 : day - 1));
  
  const names = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  const cells = [];
  for (let i=0; i<7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = d.toISOString().slice(0,10);
    const isToday = dStr === today();
    const isActive = dStr === currentAgendaDate;
    const hasEvents = agenda.some(a => a.date === dStr);
    cells.push(`
      <div class="day-cell ${isToday?'today':''} ${isActive?'active':''}" onclick="selectAgendaDate('${dStr}')">
        <div class="day-name">${names[i]}</div>
        <div class="day-num">${d.getDate()}</div>
        ${hasEvents ? '<span class="has-events"></span>' : ''}
      </div>
    `);
  }
  $('weekStrip').innerHTML = cells.join('');
}

function selectAgendaDate(date) {
  currentAgendaDate = date;
  renderWeekStrip();
  renderAgendaList();
}

function renderAgendaList() {
  const date = currentAgendaDate || today();
  const d = new Date(date);
  const opts = { weekday:'long', day:'2-digit', month:'long' };
  $('agendaDateLabel').textContent = d.toLocaleDateString('pt-BR', opts);
  
  const items = agenda
    .filter(a => a.date === date)
    .sort((a,b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  
  $('agendaList').innerHTML = items.length ? items.map(a => {
    const c = clients.find(x => x.id === a.clientId);
    const temp = c ? getTemp(c) : 'none';
    return `
      <div class="agenda-item ${temp} ${a.done?'done':''}" onclick="openEditAgenda('${a.id}')">
        <div class="agenda-row">
          <div>
            <div class="agenda-name">${a.clientName || (c?.nome || 'Cliente')}</div>
            ${c?.empresa ? `<div class="agenda-company">${c.empresa}</div>` : ''}
          </div>
          <div class="agenda-time">${a.time || '--:--'}</div>
        </div>
        ${a.obs ? `<div class="agenda-obs">${a.obs}</div>` : ''}
      </div>
    `;
  }).join('') : '<p style="color:var(--text2);text-align:center;padding:2rem 0">Nenhum compromisso neste dia</p>';
}

function openNewAgendaModal() {
  $('a_id').value = '';
  $('a_date').value = currentAgendaDate || today();
  $('a_time').value = '';
  $('a_obs').value = '';
  $('agendaModalTitle').textContent = 'Novo Compromisso';
  $('deleteAgendaBtn').style.display = 'none';
  populateAgendaClients();
  $('agendaModal').classList.add('show');
}

function openEditAgenda(id) {
  const a = agenda.find(x => x.id === id);
  if (!a) return;
  $('a_id').value = a.id;
  populateAgendaClients(a.clientId);
  $('a_date').value = a.date;
  $('a_time').value = a.time || '';
  $('a_obs').value = a.obs || '';
  $('agendaModalTitle').textContent = 'Editar Compromisso';
  $('deleteAgendaBtn').style.display = 'inline-flex';
  $('agendaModal').classList.add('show');
}

function populateAgendaClients(selectedId) {
  const sel = $('a_client');
  const sorted = [...clients].sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
  sel.innerHTML = '<option value="">(Sem cliente vinculado)</option>' + 
    sorted.map(c => `<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.nome}${c.empresa?' - '+c.empresa:''}</option>`).join('');
}

function closeAgendaModal() { $('agendaModal').classList.remove('show'); }

function saveAgenda() {
  const date = $('a_date').value;
  if (!date) { showToast('⚠️ Selecione a data', 'error'); return; }
  
  const id = $('a_id').value;
  const clientId = $('a_client').value;
  const c = clients.find(x => x.id === clientId);
  
  const data = {
    clientId,
    clientName: c?.nome || '',
    date,
    time: $('a_time').value,
    obs: $('a_obs').value.trim(),
    done: false
  };
  
  if (id) {
    const a = agenda.find(x => x.id === id);
    Object.assign(a, data);
  } else {
    agenda.push({ id: 'a_' + Date.now(), ...data });
  }
  
  saveToCache();
  syncToSheets();
  closeAgendaModal();
  renderAgenda();
  showToast('✅ Compromisso salvo!');
}

function deleteAgenda() {
  const id = $('a_id').value;
  if (!id || !confirm('Excluir esse compromisso?')) return;
  agenda = agenda.filter(a => a.id !== id);
  saveToCache();
  syncToSheets();
  closeAgendaModal();
  renderAgenda();
  showToast('🗑️ Excluído');
}

// ====== REPORTS ======
function renderReports() {
  const hot = clients.filter(c => getTemp(c) === 'hot');
  const warm = clients.filter(c => getTemp(c) === 'warm');
  const cold = clients.filter(c => getTemp(c) === 'cold');
  
  $('rTotal').textContent = clients.length;
  $('rHot').textContent = hot.length;
  $('rWarm').textContent = warm.length;
  $('rCold').textContent = cold.length;
  
  // Top by purchaseCount or by most recent contact
  const top = [...clients]
    .filter(c => c.purchaseCount || c.lastContact)
    .sort((a,b) => (b.purchaseCount||0) - (a.purchaseCount||0) || (new Date(b.lastContact||0) - new Date(a.lastContact||0)))
    .slice(0, 10);
  
  $('rTopClients').innerHTML = top.map(clientCardHTML).join('') || '<p style="color:var(--text2);text-align:center;padding:1rem">Sem dados ainda</p>';
}

// ====== IMPORT ======
function openImportModal() {
  importBuffer = [];
  $('importFile').value = '';
  $('importPreview').style.display = 'none';
  $('importConfirmBtn').style.display = 'none';
  $('importModal').classList.add('show');
}

function closeImportModal() { $('importModal').classList.remove('show'); }

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = ev => parseCSV(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      parseCSV(csv);
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('❌ Formato não suportado', 'error');
  }
}

function parseCSV(text) {
  // Split by lines
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { showToast('❌ Arquivo vazio', 'error'); return; }
  
  // Detect delimiter
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/^"|"$/g,''));
  
  const idx = {
    nome: headers.findIndex(h => /nome|contato|cliente/.test(h)),
    empresa: headers.findIndex(h => /empresa|razao/.test(h)),
    telefone: headers.findIndex(h => /telefone|fone|whatsapp|celular/.test(h)),
    email: headers.findIndex(h => /email|e.?mail/.test(h)),
    cnpj: headers.findIndex(h => /cnpj/.test(h)),
    cidade: headers.findIndex(h => /cidade|local/.test(h)),
    obs: headers.findIndex(h => /obs|observ|nota/.test(h))
  };
  
  importBuffer = [];
  for (let i=1; i<lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g,''));
    const nome = idx.nome >= 0 ? cols[idx.nome] : '';
    const telefone = idx.telefone >= 0 ? cols[idx.telefone] : '';
    if (!nome && !telefone) continue;
    importBuffer.push({
      id: uid(),
      nome: nome || telefone,
      empresa: idx.empresa >= 0 ? cols[idx.empresa] : '',
      telefone,
      email: idx.email >= 0 ? cols[idx.email] : '',
      cnpj: idx.cnpj >= 0 ? cols[idx.cnpj] : '',
      cidade: idx.cidade >= 0 ? cols[idx.cidade] : '',
      obs: idx.obs >= 0 ? cols[idx.obs] : '',
      lastContact: '',
      createdAt: today(),
      history: []
    });
  }
  
  $('importCount').innerHTML = `<strong>${importBuffer.length}</strong> contatos prontos para importar.`;
  $('importPreview').style.display = 'block';
  $('importConfirmBtn').style.display = 'inline-flex';
}

function confirmImport() {
  if (importBuffer.length === 0) return;
  clients = [...clients, ...importBuffer];
  saveToCache();
  syncToSheets();
  closeImportModal();
  navigate('clients');
  showToast(`✅ ${importBuffer.length} contatos importados!`);
}

// ====== BACKUP / CACHE ======
function exportBackup() {
  const data = { clients, agenda, exportedAt: now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autovenda-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 Backup exportado!');
}

function clearLocalCache() {
  if (!confirm('Limpar cache local? Isso NÃO apaga os dados do Sheets.')) return;
  localStorage.removeItem('crm_clients');
  localStorage.removeItem('crm_agenda');
  showToast('🗑️ Cache limpo. Recarregando...');
  setTimeout(() => location.reload(), 800);
}

// ====== RENDER ALL ======
function renderAll() {
  if (currentPage === 'home') renderHome();
  if (currentPage === 'clients') renderClients();
  if (currentPage === 'agenda') renderAgenda();
  if (currentPage === 'reports') renderReports();
}

// ====== INIT ======
async function initApp() {
  loadFromCache();
  renderHome();
  
  // Decide se busca do Sheets (cache > 5 min ou nunca buscou)
  const lastSync = parseInt(localStorage.getItem('lastSync') || '0');
  const ageMin = (Date.now() - lastSync) / 60000;
  if (!lastSync || ageMin > CACHE_MIN) {
    await loadFromSheets();
    renderAll();
  }
  
  updateLastSyncLabel();
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.classList.remove('show');
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    $('loadingScreen').style.display = 'none';
    if (localStorage.getItem('crm_auth')) {
      $('app').style.display = 'flex';
      initApp();
    } else {
      $('loginScreen').style.display = 'flex';
    }
  }, 800);
});
