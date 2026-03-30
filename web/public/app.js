const socket = io();

const sensors = new Map();
const markers = new Map();
const miniMarkers = new Map();

let map;
let miniMap;
let currentPage = "dashboard";
let selectedSensorId = null;
let incidents = [];
let selectedIncidentId = null;
let incidentFilter = "all";
let incidentQuery = "";

const guestNames = [
  "김철수",
  "백승호",
  "박민수",
  "홍주원",
  "정수진",
  "최수영",
  "정하늘",
  "박서연",
  "한지민",
  "이도현"
];

const beachNames = [
  "송정해수욕장",
  "곽지해수욕장",
  "다대포해수욕장",
  "경포해수욕장",
  "협재해수욕장",
  "속초해수욕장"
];

function getSensorName(id) {
  return guestNames[(Number(id) - 1) % guestNames.length] || `게스트 ${id}`;
}

function getBeachName(id) {
  return beachNames[(Number(id) - 1) % beachNames.length] || "미확인 구역";
}

function isValidCoordinate(sensor) {
  return Boolean(sensor && Number(sensor.lat) && Number(sensor.lon));
}

function getStatusClass(status) {
  if (status === "danger") return "is-danger";
  if (status === "warning") return "is-warn";
  if (status === "offline") return "is-offline";
  return "is-safe";
}

function getStatusText(status) {
  if (status === "danger") return "위험";
  if (status === "warning") return "주의";
  if (status === "offline") return "오프라인";
  return "안전";
}

function getPriorityText(status) {
  if (status === "danger") return "P1";
  if (status === "warning") return "P2";
  return "OK";
}

function getRiskScore(sensor) {
  if (sensor.status === "danger") return 85;
  if (sensor.status === "warning") {
    return sensor.finger === 0 ? 45 : 63;
  }

  const bpm = Number(sensor.bpm) || 82;
  return Math.max(5, Math.min(38, Math.round((bpm - 65) * 0.55)));
}

function getBatteryLevel(sensor) {
  const seed = (Number(sensor.id) * 19) % 61;
  return Math.max(18, Math.min(94, 33 + seed));
}

function getAvatarClass(id) {
  const classes = ["", "is-alt", "is-alt-2", "is-alt-3", "is-alt-4"];
  return classes[(Number(id) - 1) % classes.length];
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "방금 전";

  const target = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - target) / 1000));

  if (seconds < 60) return `${Math.max(1, seconds)}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function getSensorSubtitle(sensor) {
  if (sensor.finger === 0) return "손가락 센서 미착용";
  return `심박 ${Number(sensor.bpm) || 0} bpm`;
}

function getAlertDescription(sensor) {
  if (sensor.status === "danger") return `심박수 ${Number(sensor.bpm) || 0}bpm, HRV 급락 감지`;
  if (sensor.finger === 0) return "센서 착용 불량 또는 측정 오류";
  return "지속적 고심박, 휴식 필요";
}

function getAlertScoreText(sensor) {
  if (sensor.status === "danger") return `과부하 / 위험스코어 ${getRiskScore(sensor)}`;
  if (sensor.finger === 0) return `지오펜스 이탈 / 위험스코어 ${getRiskScore(sensor)}`;
  return `피로누적 / 위험스코어 ${getRiskScore(sensor)}`;
}

function createMarkerIcon(status) {
  return L.divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div class="map-marker ${getStatusClass(status)}"></div>`
  });
}

function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText =
      "position:fixed;right:18px;top:18px;z-index:1000;display:grid;gap:10px;";
    document.body.appendChild(container);
  }

  const colors = {
    success: "#18b26b",
    warning: "#f7b731",
    error: "#ef4444",
    info: "#0f6189"
  };

  const toast = document.createElement("div");
  toast.style.cssText = [
    "min-width:220px",
    "max-width:320px",
    "padding:12px 14px",
    "border-radius:14px",
    "color:#fff",
    "font-size:12px",
    "font-weight:700",
    "box-shadow:0 12px 24px rgba(10,38,59,.18)",
    `background:${colors[type] || colors.info}`,
    "transform:translateY(-8px)",
    "opacity:0",
    "transition:transform .18s ease, opacity .18s ease"
  ].join(";");
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  });

  setTimeout(() => {
    toast.style.transform = "translateY(-8px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

function updateStatusIndicator(status) {
  const sidebarDot = document.getElementById("sidebarStatusDot");
  const mobileDot = document.getElementById("mobileStatusDot");
  const sidebarText = document.getElementById("sidebarStatusText");
  const isOnline = Boolean(status && status.connected);

  [sidebarDot, mobileDot].forEach((dot) => {
    if (!dot) return;
    dot.classList.toggle("is-online", isOnline);
    dot.classList.toggle("is-offline", !isOnline);
  });

  if (sidebarText) {
    if (isOnline) {
      sidebarText.textContent = `${status.port || "시리얼"} 연결됨`;
    } else {
      sidebarText.textContent = status?.message || "센서 대기 중";
    }
  }
}

function switchPage(page) {
  currentPage = page;

  document.querySelectorAll(".page").forEach((node) => {
    node.classList.toggle("is-active", node.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.page === page);
  });

  closeSidebar();

  if (page === "livemap") {
    setTimeout(() => {
      map?.invalidateSize();
      miniMap?.invalidateSize();
    }, 100);
  }

  if (page === "incidents") {
    loadIncidents();
  }
}

window.switchPage = switchPage;

function openSidebar() {
  document.getElementById("sidebar")?.classList.add("is-open");
  document.getElementById("sidebarBackdrop")?.classList.add("is-visible");
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("is-open");
  document.getElementById("sidebarBackdrop")?.classList.remove("is-visible");
}

function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((node) => {
    node.addEventListener("click", () => switchPage(node.dataset.page));
  });

  document.getElementById("menuBtn")?.addEventListener("click", openSidebar);
  document.getElementById("sidebarBackdrop")?.addEventListener("click", closeSidebar);
  document.getElementById("goLiveMapBtn")?.addEventListener("click", () => switchPage("livemap"));

  document.getElementById("incidentSearch")?.addEventListener("input", (event) => {
    incidentQuery = event.target.value.trim().toLowerCase();
    renderIncidentList();
  });

  document.getElementById("incidentTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-button");
    if (!button) return;

    incidentFilter = button.dataset.filter;
    document.querySelectorAll(".tab-button").forEach((node) => {
      node.classList.toggle("is-active", node === button);
    });
    renderIncidentList();
  });

  document.getElementById("btnRecenter")?.addEventListener("click", recenterToSensors);
}

function initMaps() {
  miniMap = L.map("miniMap", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false
  }).setView([35.1595, 129.1603], 12);

  map = L.map("map", {
    zoomControl: true,
    attributionControl: false
  }).setView([35.1595, 129.1603], 12);

  const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  });

  const tileLayerMini = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  });

  tileLayer.addTo(map);
  tileLayerMini.addTo(miniMap);
}

function syncMarker(sensor, targetMap, store) {
  if (!isValidCoordinate(sensor)) return;

  const position = [Number(sensor.lat), Number(sensor.lon)];
  const marker = store.get(sensor.id);
  const popupHtml = `
    <strong>${getSensorName(sensor.id)}</strong><br>
    ${getBeachName(sensor.id)}<br>
    심박: ${sensor.finger === 0 ? "미측정" : `${Number(sensor.bpm) || 0} bpm`}<br>
    상태: ${getStatusText(sensor.status)}
  `;

  if (marker) {
    marker.setLatLng(position);
    marker.setIcon(createMarkerIcon(sensor.status));
    marker.setPopupContent(popupHtml);
    return;
  }

  const nextMarker = L.marker(position, {
    icon: createMarkerIcon(sensor.status)
  }).addTo(targetMap);

  nextMarker.bindPopup(popupHtml);
  nextMarker.on("click", () => {
    selectSensor(sensor.id);
    if (targetMap === miniMap) switchPage("livemap");
  });

  store.set(sensor.id, nextMarker);
}

function recenterToSensors() {
  const points = Array.from(sensors.values())
    .filter(isValidCoordinate)
    .map((sensor) => [Number(sensor.lat), Number(sensor.lon)]);

  if (!points.length) return;

  const bounds = L.latLngBounds(points);
  map?.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  miniMap?.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
}

function upsertSensor(sensor) {
  sensors.set(sensor.id, sensor);
  syncMarker(sensor, map, markers);
  syncMarker(sensor, miniMap, miniMarkers);
}

function sortSensorsByPriority(list) {
  const rank = { danger: 0, warning: 1, normal: 2, offline: 3 };
  return [...list].sort((left, right) => {
    const diff = rank[left.status] - rank[right.status];
    if (diff !== 0) return diff;
    return Number(left.id) - Number(right.id);
  });
}

function renderDashboard() {
  const allSensors = sortSensorsByPriority(Array.from(sensors.values()));
  const normalCount = allSensors.filter((sensor) => sensor.status === "normal").length;
  const warningCount = allSensors.filter((sensor) => sensor.status === "warning").length;
  const dangerCount = allSensors.filter((sensor) => sensor.status === "danger").length;
  const alertSensors = allSensors.filter((sensor) => sensor.status !== "normal" && sensor.status !== "offline");

  document.getElementById("statTotal").textContent = String(allSensors.length);
  document.getElementById("statNormal").textContent = String(normalCount);
  document.getElementById("statWarning").textContent = String(warningCount);
  document.getElementById("statDanger").textContent = String(dangerCount);
  document.getElementById("guestCountLabel").textContent = `${allSensors.length}명 연결됨`;
  document.getElementById("alertCountLabel").textContent = `${alertSensors.length}건`;

  document.getElementById("heroSummary").textContent =
    allSensors.length > 0
      ? `현재 ${allSensors.length}명의 게스트가 모니터링 중이며, 위험 ${dangerCount}명, 주의 ${warningCount}명 상태입니다.`
      : "현재 연결된 센서가 없습니다. 기기가 연결되면 실시간 현황이 자동으로 갱신됩니다.";

  const banner = document.getElementById("alertBanner");
  const alertText = document.getElementById("alertText");
  const dashboardNotice = document.getElementById("dashboardNotice");

  if (alertSensors.length > 0) {
    banner.hidden = false;
    alertText.textContent = `${alertSensors.length}건의 즉시 확인이 필요한 알림이 있습니다.`;
    dashboardNotice.textContent = `${dangerCount}건 위험, ${warningCount}건 주의 상태가 감지되었습니다.`;
  } else {
    banner.hidden = true;
    dashboardNotice.textContent = "실시간 알림이 없습니다.";
  }

  renderActiveGuestList(allSensors);
  renderAlertCards(alertSensors);
  renderGuestGrid(allSensors);
  renderDeviceList(allSensors);
}

function renderActiveGuestList(sensorList) {
  const container = document.getElementById("activeGuestList");

  if (!sensorList.length) {
    container.innerHTML = `<div class="empty-state-card">연결된 게스트가 없습니다.<br>센서가 연결되면 목록이 자동으로 채워집니다.</div>`;
    return;
  }

  container.innerHTML = sensorList
    .map((sensor) => {
      const battery = getBatteryLevel(sensor);
      const batteryClass =
        battery < 30 ? "is-danger" : battery < 50 ? "is-warn" : "";

      return `
        <button class="guest-row" type="button" data-select-sensor="${sensor.id}">
          <span class="avatar-badge ${getAvatarClass(sensor.id)}">${String(sensor.id).padStart(2, "0")}</span>
          <span class="guest-row__copy">
            <strong>${getSensorName(sensor.id)} <span class="priority-pill ${getStatusClass(sensor.status)}">${getPriorityText(
              sensor.status
            )}</span></strong>
            <span>${getSensorSubtitle(sensor)} · ${getBeachName(sensor.id)}</span>
          </span>
          <span class="battery-meter ${batteryClass}">
            <span class="battery-meter__fill" style="width:${battery}%"></span>
          </span>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-select-sensor]").forEach((node) => {
    node.addEventListener("click", () => {
      selectSensor(node.dataset.selectSensor);
      switchPage("livemap");
    });
  });
}

function renderAlertCards(alertSensors) {
  const container = document.getElementById("alertCards");

  if (!alertSensors.length) {
    container.innerHTML =
      '<div class="empty-state-card">현재 확인이 필요한 위험 알림이 없습니다.</div>';
    return;
  }

  container.innerHTML = alertSensors
    .map((sensor) => {
      const dangerClass = sensor.status === "danger" ? "alert-card--danger" : "";
      return `
        <button class="alert-card ${dangerClass}" type="button" data-select-sensor="${sensor.id}">
          <span class="priority-pill ${getStatusClass(sensor.status)}">${getPriorityText(sensor.status)}</span>
          <div class="alert-card__name">${getSensorName(sensor.id)}</div>
          <div class="alert-card__score">${getAlertScoreText(sensor)}</div>
          <div class="alert-card__body">${getAlertDescription(sensor)}</div>
          <div class="alert-card__meta">
            <span>${formatRelativeTime(sensor.lastUpdate)}</span>
            <span>${getBeachName(sensor.id)}</span>
          </div>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-select-sensor]").forEach((node) => {
    node.addEventListener("click", () => {
      selectSensor(node.dataset.selectSensor);
      switchPage("livemap");
    });
  });
}

function renderGuestGrid(sensorList) {
  const container = document.getElementById("guestGrid");

  if (!sensorList.length) {
    container.innerHTML =
      '<div class="empty-state-card">게스트 데이터가 없습니다.</div>';
    return;
  }

  container.innerHTML = sensorList
    .map((sensor) => {
      const isSelected = String(sensor.id) === String(selectedSensorId);
      return `
        <button
          class="guest-chip"
          type="button"
          data-select-sensor="${sensor.id}"
          style="${isSelected ? "outline:2px solid rgba(12,79,116,.24)" : ""}"
        >
          <span class="guest-chip__dot ${getStatusClass(sensor.status)}"></span>
          <span>
            <strong>${getSensorName(sensor.id)}</strong>
            <span>${sensor.finger === 0 ? "미측정" : `${Number(sensor.bpm) || 0} bpm`}</span>
          </span>
          <span class="guest-chip__score">${getRiskScore(sensor)}점</span>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-select-sensor]").forEach((node) => {
    node.addEventListener("click", () => selectSensor(node.dataset.selectSensor));
  });
}

function renderSelectedGuest(sensor) {
  const container = document.getElementById("selectedGuest");

  if (!sensor) {
    container.innerHTML = `
      <div class="panel-card__head">
        <h2>선택된 게스트</h2>
      </div>
      <div class="empty-box">지도에서 게스트를 선택하면 상세 정보가 표시됩니다.</div>
    `;
    renderBattery(null);
    return;
  }

  container.innerHTML = `
    <div class="panel-card__head">
      <h2>선택된 게스트</h2>
      <span>${getStatusText(sensor.status)}</span>
    </div>
    <div class="selected-guest">
      <div class="selected-guest__head">
        <span class="avatar-badge ${getAvatarClass(sensor.id)}">${String(sensor.id).padStart(2, "0")}</span>
        <div class="selected-guest__copy">
          <strong>${getSensorName(sensor.id)} <span class="priority-pill ${getStatusClass(sensor.status)}">${getPriorityText(
            sensor.status
          )}</span></strong>
          <span>${getBeachName(sensor.id)} · 최근 업데이트 ${formatRelativeTime(sensor.lastUpdate)}</span>
        </div>
      </div>
      <div class="vital-grid">
        <div class="vital-card">
          <div class="vital-card__label">위험 스코어</div>
          <div class="vital-card__value">${getRiskScore(sensor)}점</div>
          <div class="vital-card__hint">${getAlertScoreText(sensor)}</div>
        </div>
        <div class="vital-card">
          <div class="vital-card__label">심박수</div>
          <div class="vital-card__value">${sensor.finger === 0 ? "--" : Number(sensor.bpm) || 0}</div>
          <div class="vital-card__hint">${sensor.finger === 0 ? "센서 미착용" : "bpm 기준 실시간 수집"}</div>
        </div>
      </div>
      <div class="detail-block">
        <h3>위치 정보</h3>
        <p>위도 ${Number(sensor.lat || 0).toFixed(5)} / 경도 ${Number(sensor.lon || 0).toFixed(5)}</p>
        <p>${getBeachName(sensor.id)} 기준 위치 추적 중</p>
      </div>
    </div>
  `;

  renderBattery(sensor);
}

function renderBattery(sensor) {
  const container = document.getElementById("batteryArea");

  if (!sensor) {
    container.innerHTML =
      '<div class="battery-box__empty">선택된 기기의 배터리 상태가 표시됩니다.</div>';
    return;
  }

  const battery = getBatteryLevel(sensor);
  container.innerHTML = `
    <div class="battery-bar">
      <div class="battery-bar__meta">
        <span>${getSensorName(sensor.id)}</span>
        <span>${battery}%</span>
      </div>
      <div class="battery-bar__track">
        <div class="battery-bar__fill" style="width:${battery}%"></div>
      </div>
    </div>
  `;
}

function renderDeviceList(sensorList) {
  const container = document.getElementById("deviceList");
  const label = document.getElementById("deviceCountLabel");
  label.textContent = `${sensorList.length}대`;

  if (!sensorList.length) {
    container.innerHTML =
      '<div class="empty-state-card">등록된 디바이스가 없습니다.</div>';
    return;
  }

  container.innerHTML = sensorList
    .map((sensor) => {
      return `
        <article class="device-card">
          <span class="avatar-badge ${getAvatarClass(sensor.id)}">${String(sensor.id).padStart(2, "0")}</span>
          <div class="device-card__copy">
            <strong>${getSensorName(sensor.id)}</strong>
            <span>${getBeachName(sensor.id)} · ${isValidCoordinate(sensor) ? `${Number(sensor.lat).toFixed(4)}, ${Number(sensor.lon).toFixed(4)}` : "위치 미수신"}</span>
          </div>
          <span class="priority-pill ${getStatusClass(sensor.status)}">${getStatusText(sensor.status)}</span>
        </article>
      `;
    })
    .join("");
}

function selectSensor(sensorId) {
  selectedSensorId = String(sensorId);
  const sensor = sensors.get(Number(sensorId)) || sensors.get(String(sensorId));

  if (sensor && isValidCoordinate(sensor)) {
    map?.setView([Number(sensor.lat), Number(sensor.lon)], 15);
    markers.get(sensor.id)?.openPopup();
  }

  renderSelectedGuest(sensor);
  renderDashboard();
}

function renderIncidentList() {
  const container = document.getElementById("incidentList");

  let filtered = [...incidents];

  if (incidentFilter !== "all") {
    filtered = filtered.filter((incident) => incident.status === incidentFilter);
  }

  if (incidentQuery) {
    filtered = filtered.filter((incident) => {
      const text = `${incident.incident_id} ${incident.description} ${incident.type}`.toLowerCase();
      return text.includes(incidentQuery);
    });
  }

  if (!filtered.length) {
    container.innerHTML =
      '<div class="empty-state-card">표시할 사건 로그가 없습니다.</div>';
    return;
  }

  container.innerHTML = filtered
    .map((incident) => {
      const selected = incident.incident_id === selectedIncidentId ? "is-selected" : "";
      return `
        <button class="incident-item ${selected}" type="button" data-incident-id="${incident.incident_id}">
          <div class="incident-item__top">
            <span class="incident-item__id">${incident.incident_id}</span>
            <span class="priority-pill ${incident.status === "active" ? "is-danger" : "is-safe"}">${
              incident.status === "active" ? "진행중" : "완료"
            }</span>
          </div>
          <div class="incident-item__desc">${incident.description || "설명 없음"}</div>
          <div class="incident-item__meta">${formatDateTime(incident.created_at)}</div>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-incident-id]").forEach((node) => {
    node.addEventListener("click", () => {
      const incident = incidents.find((item) => item.incident_id === node.dataset.incidentId);
      selectIncident(incident);
    });
  });
}

function renderIncidentDetail(incident) {
  const container = document.getElementById("incidentDetail");

  if (!incident) {
    container.innerHTML = '<div class="empty-box">왼쪽 목록에서 사건을 선택하세요.</div>';
    return;
  }

  const sensorName = getSensorName(incident.sensor_id || 1);
  const assignedAgent = incident.status === "active" ? "김코치" : "처리 완료";

  container.innerHTML = `
    <div class="panel-card__head">
      <h2>${incident.incident_id}</h2>
      <span>${incident.status === "active" ? "사건 대응 중" : "사건 처리 완료"}</span>
    </div>
    <div class="incident-detail__body">
      <div class="detail-block">
        <h3>게스트 정보</h3>
        <p>${sensorName} / 센서 ${incident.sensor_id || "-"}</p>
        <p>${incident.description || "상세 설명 없음"}</p>
      </div>
      <div class="detail-block">
        <h3>배정 인력</h3>
        <p>${assignedAgent}</p>
      </div>
      <div class="detail-block">
        <h3>타임라인</h3>
        <ul class="detail-list">
          <li>${formatDateTime(incident.created_at)} 사건 감지</li>
          <li>${formatDateTime(incident.created_at)} 운영자 알림 전송</li>
          <li>${incident.resolved_at ? `${formatDateTime(incident.resolved_at)} 사건 종료` : "현재 추가 조치 대기 중"}</li>
        </ul>
      </div>
    </div>
  `;
}

function selectIncident(incident) {
  selectedIncidentId = incident?.incident_id || null;
  renderIncidentList();
  renderIncidentDetail(incident);
}

async function loadIncidents() {
  try {
    const response = await fetch("/api/incidents");
    incidents = await response.json();
    renderIncidentList();

    if (selectedIncidentId) {
      const active = incidents.find((incident) => incident.incident_id === selectedIncidentId);
      renderIncidentDetail(active || null);
    }
  } catch (error) {
    document.getElementById("incidentList").innerHTML =
      '<div class="empty-state-card">사건 로그를 불러오지 못했습니다.</div>';
  }
}

socket.on("connect", () => {
  showToast("서버와 연결되었습니다.", "success");
});

socket.on("disconnect", () => {
  updateStatusIndicator({ connected: false, message: "서버 연결 끊김" });
  showToast("서버 연결이 끊어졌습니다.", "error");
});

socket.on("serialStatus", (status) => {
  updateStatusIndicator(status);
});

socket.on("initialState", (list) => {
  list.forEach(upsertSensor);
  renderDashboard();

  if (list.length > 0) {
    recenterToSensors();
    if (!selectedSensorId) {
      selectSensor(list[0].id);
    }
  }
});

socket.on("sensorUpdate", (sensor) => {
  upsertSensor(sensor);
  renderDashboard();

  if (String(sensor.id) === String(selectedSensorId)) {
    renderSelectedGuest(sensor);
  }
});

socket.on("deviceRegistered", (device) => {
  showToast(`${device.name} 기기가 자동 등록되었습니다.`, "success");
});

socket.on("autoCenter", (coords) => {
  if (coords && Number(coords.lat) && Number(coords.lon)) {
    map?.setView([Number(coords.lat), Number(coords.lon)], 15);
    miniMap?.setView([Number(coords.lat), Number(coords.lon)], 13);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initMaps();
  renderDashboard();
  renderSelectedGuest(null);
  renderIncidentDetail(null);
  loadIncidents();
});
