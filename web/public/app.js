/* ═══════════════════════════════════════════════
   Marine Guard — App Logic (Figma-matched)
   ═══════════════════════════════════════════════ */
const socket = io();
const sensors = {};
let map = null, miniMap = null;
let markers = {}, miniMarkers = {};
let selectedSensorId = null, selectedIncidentId = null;
let currentPage = 'dashboard';
const avatarCls = ['','a2','a3','a4','a5'];

// ═══════════ NAVIGATION ═══════════
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => { switchPage(item.dataset.page); closeMobile(); });
});
function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.add('active');
  if (page === 'livemap' && map) setTimeout(() => map.invalidateSize(), 100);
  if (page === 'incidents') loadIncidents();
}
document.getElementById('menuBtn')?.addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); });
document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobile);
function closeMobile() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }

// ═══════════ MAP ═══════════
function initMap() {
  map = L.map('map', { center: [35.097, 128.994], zoom: 15, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  miniMap = L.map('miniMap', { center: [35.097, 128.994], zoom: 14, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
}
function updateMarker(sensor, targetMap, targetMarkers) {
  const { id, lat, lon, status } = sensor;
  if (!lat || lat === 0) return;
  const cls = `marker-${status}`;
  const icon = L.divIcon({ html: `<div class="custom-marker ${cls}">${id}</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: '' });
  if (targetMarkers[id]) { targetMarkers[id].setLatLng([lat, lon]).setIcon(icon); }
  else { targetMarkers[id] = L.marker([lat, lon], { icon }).addTo(targetMap).on('click', () => { selectSensor(id); if (targetMap === miniMap) switchPage('livemap'); }); }
  if (targetMap === map) targetMarkers[id].bindPopup(`<b>센서 ${id}</b><br>위도: ${lat.toFixed(6)}<br>경도: ${lon.toFixed(6)}<br>심박: ${sensor.bpm||'--'} BPM<br>상태: ${statusText(status)}`);
}
function recenterMap() {
  const arr = Object.values(sensors).filter(s => s.lat && s.lat !== 0);
  if (arr.length > 0) { const b = L.latLngBounds(arr.map(s => [s.lat, s.lon])); map.fitBounds(b, { padding: [50, 50], maxZoom: 16 }); miniMap.fitBounds(b, { padding: [20, 20], maxZoom: 15 }); }
}
document.getElementById('btnRecenter')?.addEventListener('click', recenterMap);

// ═══════════ SENSOR UPDATE ═══════════
function handleSensorUpdate(sensor) {
  sensors[sensor.id] = sensor;
  if (Object.keys(sensors).length === 1 && sensor.lat && sensor.lat !== 0) { map.setView([sensor.lat, sensor.lon], 15); miniMap.setView([sensor.lat, sensor.lon], 14); }
  updateDashboard();
  updateMarker(sensor, map, markers);
  updateMarker(sensor, miniMap, miniMarkers);
  updateGuestGrid();
  if (selectedSensorId === sensor.id) renderSelectedGuest(sensor);
  // Alert banner
  const dng = Object.values(sensors).filter(s => s.status === 'danger');
  const ab = document.getElementById('alertBanner');
  const at = document.getElementById('alertText');
  if (dng.length > 0) { ab.style.display = 'flex'; at.textContent = `${dng.length}건의 비상 상황이 감지되었습니다`; }
  else { ab.style.display = 'none'; }
}

// ═══════════ DASHBOARD ═══════════
function updateDashboard() {
  const all = Object.values(sensors);
  document.getElementById('statTotal').textContent = all.length;
  document.getElementById('statNormal').textContent = all.filter(s => s.status === 'normal').length;
  document.getElementById('statWarning').textContent = all.filter(s => s.status === 'warning').length;
  document.getElementById('statDanger').textContent = all.filter(s => s.status === 'danger').length;
  renderActiveGuests();
  renderAlertCards();
}

function renderActiveGuests() {
  const c = document.getElementById('activeGuestList');
  const all = Object.values(sensors);
  if (!all.length) { c.innerHTML = '<div class="empty-state"><p>센서 데이터 대기 중...</p><small>웨어러블 센서가 연결되면 자동으로 표시됩니다</small></div>'; return; }
  c.innerHTML = all.map(s => {
    const av = avatarCls[(s.id - 1) % avatarCls.length];
    const pri = s.status === 'danger' ? '<span class="priority-badge p1">P1</span>' : s.status === 'warning' ? '<span class="priority-badge p2">P2</span>' : '<span class="priority-badge ok">OK</span>';
    const batt = Math.max(0, Math.min(100, 80 + Math.random() * 20)); // simulated
    return `<div class="guest-row" onclick="selectSensorAndGo(${s.id})">
      <div class="guest-avatar ${av}">${s.id}</div>
      <div class="guest-meta">
        <div class="guest-name">센서${s.id} ${pri}</div>
        <div class="guest-sub">${s.finger === 1 ? s.bpm + ' BPM' : '미착용'}</div>
      </div>
      <div class="battery-icon${batt < 20 ? ' low' : ''}"><div class="battery-fill" style="width:${batt}%"></div></div>
    </div>`;
  }).join('');
}

function renderAlertCards() {
  const c = document.getElementById('alertCards');
  const alerts = Object.values(sensors).filter(s => s.status === 'danger' || s.status === 'warning');
  if (!alerts.length) { c.innerHTML = '<div class="empty-state"><p>이상 징후가 없습니다</p></div>'; return; }
  const sorted = alerts.sort((a, b) => (a.status === 'danger' ? 0 : 1) - (b.status === 'danger' ? 0 : 1));
  c.innerHTML = sorted.map(s => {
    const isP1 = s.status === 'danger';
    const msg = isP1 ? `심박수 ${s.bpm}bpm, HRV 급락 감지` : (s.finger === 0 ? '센서 미착용 상태' : '지속적 고심박, 휴식 필요');
    const td = getTimeDiff(s.lastUpdate);
    return `<div class="alert-card${isP1 ? ' danger-glow' : ''}" onclick="selectSensorAndGo(${s.id})">
      <span class="priority-badge ${isP1 ? 'p1' : 'p2'}">${isP1 ? 'P1' : 'P2'}</span>
      <div class="alert-card-name">센서 ${s.id}</div>
      <div class="alert-card-desc">${isP1 ? '과부하' : '피로누적'} / 위험스코어 ${isP1 ? '85' : '63'}</div>
      <div class="alert-card-msg">${msg}</div>
      <div class="alert-card-footer">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>${td}</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>현재 위치</span>
      </div>
    </div>`;
  }).join('');
}

function selectSensorAndGo(id) { selectSensor(id); switchPage('livemap'); }
function selectSensor(id) {
  selectedSensorId = id;
  const s = sensors[id];
  if (s) { renderSelectedGuest(s); if (markers[id] && map) { map.setView([s.lat, s.lon], 16); markers[id].openPopup(); } }
}

// ═══════════ SELECTED GUEST (MAP SIDEBAR) ═══════════
function renderSelectedGuest(s) {
  const c = document.getElementById('selectedGuest');
  const av = avatarCls[(s.id - 1) % avatarCls.length];
  const pri = s.status === 'danger' ? 'p1' : s.status === 'warning' ? 'p2' : 'ok';
  const score = s.status === 'danger' ? 85 : s.status === 'warning' ? 63 : 12;
  const scoreColor = s.status === 'danger' ? 'var(--danger)' : s.status === 'warning' ? 'var(--warn)' : 'var(--safe)';
  const bpmVal = s.finger === 1 ? s.bpm : '--';
  const bpmColor = s.bpm > 120 ? 'var(--danger)' : s.bpm > 100 ? 'var(--warn)' : 'var(--primary)';
  const circ = 2 * Math.PI * 34;
  const offset = circ - (score / 100) * circ;

  c.innerHTML = `
    <div class="panel-head"><h3>선택된 게스트</h3></div>
    <div class="guest-detail-content">
      <div class="guest-detail-header">
        <div class="guest-avatar ${av}" style="width:48px;height:48px;font-size:16px;">${s.id}</div>
        <div><div class="guest-name" style="font-size:15px;">센서 ${s.id} <span class="priority-badge ${pri}">${pri.toUpperCase()}</span></div>
        <div class="guest-sub">위도: ${s.lat?.toFixed(5)||'--'} · 경도: ${s.lon?.toFixed(5)||'--'}</div></div>
      </div>
      <div class="gauge-grid">
        <div class="gauge-box">
          <div class="gauge-label">위험 스코어</div>
          <div class="gauge-circle">
            <svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="34"/><circle class="fg" cx="40" cy="40" r="34" stroke="${scoreColor}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/></svg>
            <div class="gauge-val" style="color:${scoreColor}">${score}<small>점</small></div>
          </div>
        </div>
        <div class="gauge-box">
          <div class="gauge-label">심박수</div>
          <div class="bpm-display" style="color:${bpmColor}">- - -<small> bpm</small></div>
          <div style="font-size:11px;color:var(--text3);">${bpmVal !== '--' ? bpmVal + ' BPM' : '측정 대기'}</div>
        </div>
      </div>
    </div>`;
}

// ═══════════ GUEST GRID ═══════════
function updateGuestGrid() {
  const c = document.getElementById('guestGrid');
  const all = Object.values(sensors);
  if (!all.length) { c.innerHTML = '<div class="empty-state small"><p>연결된 센서 없음</p></div>'; return; }
  c.innerHTML = all.map(s => {
    const dotCls = s.status === 'danger' ? 'danger' : s.status === 'warning' ? 'warn' : 'safe';
    const bpm = s.finger === 1 ? s.bpm + 'bpm' : '--';
    const score = s.status === 'danger' ? '85점' : s.status === 'warning' ? '63점' : '12점';
    return `<div class="gg-item" onclick="selectSensor(${s.id})">
      <span class="gg-dot ${dotCls}"></span>
      <span class="gg-name">센서${s.id}</span>
      <span class="gg-bpm">${bpm}</span>
      <span class="gg-score">${score}</span>
    </div>`;
  }).join('');
  // Devices page
  renderDevices();
}

function renderDevices() {
  const c = document.getElementById('deviceList');
  const all = Object.values(sensors);
  if (!all.length) { c.innerHTML = '<div class="empty-state"><p>등록된 디바이스 없음</p></div>'; return; }
  c.innerHTML = all.map(s => {
    const av = avatarCls[(s.id - 1) % avatarCls.length];
    const st = s.connected ? s.status : 'offline';
    return `<div class="device-card status-${st}">
      <div class="guest-avatar ${av}" style="width:36px;height:36px;font-size:12px;">${s.id}</div>
      <div class="guest-meta"><div class="guest-name">센서 ${s.id}</div><div class="guest-sub">${s.lat?.toFixed(4)||'--'}, ${s.lon?.toFixed(4)||'--'}</div></div>
      <span class="priority-badge ${st === 'danger' ? 'p1' : st === 'warning' ? 'p2' : 'ok'}">${statusText(st)}</span>
    </div>`;
  }).join('');
}

// ═══════════ INCIDENTS ═══════════
async function loadIncidents() {
  try {
    const res = await fetch('/api/incidents');
    const inc = await res.json();
    renderIncidentList(inc);
  } catch (e) {}
}

function renderIncidentList(incidents) {
  const c = document.getElementById('incidentList');
  if (!incidents.length) { c.innerHTML = '<div class="empty-state"><p>기록된 사건이 없습니다</p></div>'; return; }
  c.innerHTML = incidents.map(i => {
    const badgeCls = i.status === 'active' ? 'active' : 'resolved';
    const badgeText = i.status === 'active' ? '진행중' : '처리완료';
    return `<div class="inc-item${selectedIncidentId === i.incident_id ? ' selected' : ''}" onclick="selectIncident('${i.incident_id}', ${JSON.stringify(i).replace(/"/g, '&quot;')})">
      <div class="inc-item-head"><span class="inc-id">${i.incident_id}</span><span class="inc-badge ${badgeCls}">${badgeText}</span></div>
      <div class="inc-desc">${i.description}</div>
      <div class="inc-meta"><span>${formatTime(i.created_at)}</span></div>
    </div>`;
  }).join('');
}

function selectIncident(id, data) {
  selectedIncidentId = id;
  document.querySelectorAll('.inc-item').forEach(el => el.classList.remove('selected'));
  event?.currentTarget?.classList.add('selected');
  const c = document.getElementById('incidentDetail');
  const av = avatarCls[((data.sensor_id || 1) - 1) % avatarCls.length];
  c.innerHTML = `
    <div class="inc-detail-head">
      <div class="inc-detail-id">${data.incident_id}</div>
      <div class="inc-detail-person">
        <div class="guest-avatar ${av}" style="width:40px;height:40px;font-size:13px;">${data.sensor_id || '?'}</div>
        <div><div class="guest-name">센서 ${data.sensor_id || '?'} <span class="inc-badge ${data.status === 'active' ? 'active' : 'resolved'}">${data.status === 'active' ? '주의' : '처리완료'}</span></div>
        <div class="guest-sub">${data.description}</div></div>
      </div>
    </div>
    <div class="inc-detail-body">
      <div class="detail-section">
        <div class="dispatch-btn" onclick="this.textContent='요원 배정 완료'">요원 긴급 배정</div>
      </div>
      <div class="detail-section">
        <h4>배정 요원</h4>
        <div class="assigned-person">
          <div class="guest-avatar" style="width:48px;height:48px;font-size:14px;background:linear-gradient(135deg,#6366F1,#818CF8);">👤</div>
          <div><div class="guest-name">김코치</div><div class="guest-sub">현장 요원</div></div>
        </div>
      </div>
      <div class="detail-section">
        <h4>타임라인</h4>
        <div class="timeline-list">
          <div class="timeline-item"><span class="timeline-time">${formatTime(data.created_at)}</span><span class="timeline-text">위험 인지</span></div>
          <div class="timeline-item"><span class="timeline-time">${formatTime(data.created_at)}</span><span class="timeline-text">요원 배정</span></div>
          <div class="timeline-item"><span class="timeline-time">${formatTime(data.created_at)}</span><span class="timeline-text">게스트 확인</span></div>
          ${data.resolved_at ? `<div class="timeline-item"><span class="timeline-time">${formatTime(data.resolved_at)}</span><span class="timeline-text">완료</span></div>` : ''}
        </div>
      </div>
      <div class="detail-section memo-section">
        <h4>메모</h4>
        <textarea placeholder="메모를 입력하세요..."></textarea>
      </div>
    </div>`;
}

// ═══════════ CONNECTION STATUS ═══════════
function updateConnectionStatus(status) {
  const dot = document.querySelector('#connectionStatus .status-dot');
  const text = document.querySelector('#connectionStatus .status-text');
  const mDot = document.querySelector('#mobileStatus .status-dot');
  if (status.connected) {
    dot?.classList.replace('offline','online');
    mDot?.classList.replace('offline','online');
    if(text) text.textContent = `${status.port} 연결됨`;
    showToast(`✅ ${status.port} 수신기 연결됨`, 'success');
  } else {
    dot?.classList.replace('online','offline');
    mDot?.classList.replace('online','offline');
    if(text) text.textContent = status.message || (status.port ? `${status.port} 끊김` : '연결 대기');
    if (status.port) showToast(`⚠ ${status.message || '수신기 연결 끊김'}`, 'warning');
  }
}

// ═══════════ TOAST NOTIFICATION ═══════════
function showToast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:70px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = { success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#0A7E8C' };
  toast.style.cssText = `padding:12px 18px;border-radius:10px;font-size:13px;font-weight:500;color:white;background:${colors[type]||colors.info};box-shadow:0 4px 12px rgba(0,0,0,0.15);backdrop-filter:blur(8px);transform:translateX(100%);transition:all .3s ease;max-width:320px;font-family:inherit;`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ═══════════ HELPERS ═══════════
function statusText(s) { return { normal: '정상', warning: '주의', danger: '비상', offline: '오프라인' }[s] || s; }
function getTimeDiff(ts) { if (!ts) return ''; const d = Math.floor((Date.now() - ts) / 1000); if (d < 5) return '방금'; if (d < 60) return `${d}초 전`; if (d < 3600) return `${Math.floor(d / 60)}분 전`; return `${Math.floor(d / 3600)}시간 전`; }
function formatTime(dt) { if (!dt) return ''; const d = new Date(dt); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

// ═══════════ SOCKET.IO ═══════════
socket.on('connect', () => { console.log('WS connected'); showToast('서버 연결 완료', 'success'); });
socket.on('initialState', (list) => {
  list.forEach(s => { sensors[s.id] = s; updateMarker(s, map, markers); updateMarker(s, miniMap, miniMarkers); });
  updateDashboard(); updateGuestGrid();
  if (list.length) recenterMap();
});
socket.on('sensorUpdate', handleSensorUpdate);
socket.on('serialStatus', updateConnectionStatus);

// ─── Auto-center map on first GPS ───
socket.on('autoCenter', (coords) => {
  console.log('🗺️ 기준 좌표 자동 설정:', coords);
  if (map) map.setView([coords.lat, coords.lon], 15);
  if (miniMap) miniMap.setView([coords.lat, coords.lon], 14);
  showToast(`📍 기준 좌표 설정: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`, 'info');
});

// ─── Device auto-register notification ───
socket.on('deviceRegistered', (device) => {
  console.log('🆕 새 디바이스 등록:', device);
  showToast(`🆕 ${device.name} 자동 등록 완료`, 'success');
});

socket.on('disconnect', () => {
  updateConnectionStatus({ connected: false, port: null });
  showToast('서버 연결 끊김', 'error');
});

// ═══════════ INIT ═══════════
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadIncidents();
  setInterval(() => { if (currentPage === 'dashboard') renderActiveGuests(); }, 5000);
});
