import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";

const runtimeConfig = window.MARINE_GUARD_CONFIG || {};
const apiBase = (runtimeConfig.apiBase || "").replace(/\/$/, "");
const socketUrl = runtimeConfig.socketUrl || apiBase || window.location.origin;
const socketPath = runtimeConfig.socketPath || "/socket.io";
const heroImage = "https://www.figma.com/api/mcp/asset/9f6230eb-0993-4d4b-89cd-12762e677c3f";
const topProfileImage = "https://www.figma.com/api/mcp/asset/3044289f-ba5d-4c6e-9727-771628d9c6e0";
const guestPortraits = {
  1: "https://www.figma.com/api/mcp/asset/d1bebb47-99e4-413e-8161-242996ec5f12",
  2: "https://www.figma.com/api/mcp/asset/d9647765-d4aa-4795-b559-034e5b8d84ae",
  3: "https://www.figma.com/api/mcp/asset/5c861671-dcd2-42c1-a455-40af77e0f004",
  4: "https://www.figma.com/api/mcp/asset/cf1500eb-b732-464b-9b02-2ce3af753d2f",
  5: "https://www.figma.com/api/mcp/asset/f6e731e3-d6f2-4b38-a64b-971aae874696",
  6: "https://www.figma.com/api/mcp/asset/91ee9da0-64a0-413a-b764-c665e531275f",
  7: "https://www.figma.com/api/mcp/asset/420df85e-a468-43e8-809f-605af6fe24cc",
  8: "https://www.figma.com/api/mcp/asset/6114f082-5616-4d9e-a343-229e2759e29a"
};
const fallbackSensors = [
  { id: 1, bpm: 185, status: "danger", connected: true, battery: 85, finger: 1, lat: 35.1787, lon: 129.1992, lastUpdate: "2026-03-31T10:33:00+09:00" },
  { id: 2, bpm: 156, status: "warning", connected: true, battery: 63, finger: 1, lat: 35.1762, lon: 129.1984, lastUpdate: "2026-03-31T10:28:00+09:00" },
  { id: 3, bpm: 110, status: "warning", connected: true, battery: 45, finger: 0, lat: 35.1738, lon: 129.1978, lastUpdate: "2026-03-31T10:26:00+09:00" },
  { id: 4, bpm: 103, status: "normal", connected: true, battery: 21, finger: 1, lat: 35.1716, lon: 129.1967, lastUpdate: "2026-03-31T10:22:00+09:00" },
  { id: 5, bpm: 96, status: "normal", connected: true, battery: 18, finger: 1, lat: 35.1695, lon: 129.1958, lastUpdate: "2026-03-31T10:20:00+09:00" },
  { id: 6, bpm: 101, status: "normal", connected: false, battery: 12, finger: 1, lat: 35.1678, lon: 129.1949, lastUpdate: "2026-03-31T10:18:00+09:00" },
  { id: 7, bpm: 82, status: "normal", connected: false, battery: 8, finger: 1, lat: 35.1659, lon: 129.1938, lastUpdate: "2026-03-31T10:16:00+09:00" },
  { id: 8, bpm: 90, status: "normal", connected: true, battery: 5, finger: 1, lat: 35.1644, lon: 129.1928, lastUpdate: "2026-03-31T10:14:00+09:00" }
];
const fallbackIncidents = [
  { incident_id: "SJ-2025-026", sensor_id: 1, description: "심박수 185bpm, HRV 급락 감지", type: "과부하", status: "active", created_at: "2026-03-31T10:33:00+09:00" },
  { incident_id: "SJ-2025-025", sensor_id: 2, description: "지속적 고심박, 휴식 필요", type: "피로누적", status: "resolved", created_at: "2026-03-31T10:28:00+09:00" },
  { incident_id: "DDP-2025-024", sensor_id: 3, description: "안전구역을 벗어남", type: "지오펜스 이탈", status: "false_alarm", created_at: "2026-03-31T10:24:00+09:00" },
  { incident_id: "BH-2025-023", sensor_id: 4, description: "안전구역을 벗어남", type: "지오펜스 이탈", status: "resolved", created_at: "2026-03-31T10:18:00+09:00" },
  { incident_id: "WP-2025-022", sensor_id: 5, description: "부상 우려, 휴식 권장", type: "과부하", status: "resolved", created_at: "2026-03-31T10:12:00+09:00" },
  { incident_id: "SJ-2025-021", sensor_id: 6, description: "안전구역 경계선", type: "지오펜스 이탈", status: "resolved", created_at: "2026-03-31T10:08:00+09:00" }
];

const people = [
  ["김철수", 32],
  ["박서연", 24],
  ["백승호", 33],
  ["박민수", 28],
  ["이준호", 35],
  ["홍주원", 29],
  ["정수진", 25],
  ["최수영", 30],
  ["정하늘", 27],
  ["김영희", 31],
  ["이정민", 29],
  ["오지현", 26]
];
const guestOptions = people.map(([name, age], index) => ({ id: index + 1, name, age }));
const beaches = ["송정해수욕장", "광안리해수욕장", "다대포해수욕장", "경포해수욕장", "중문해수욕장", "협재해수욕장"];
const regions = ["부산", "포항", "강원도", "제주도"];
const coaches = ["박코치", "김코치", "이코치", "정코치"];
const nav = [
  ["dashboard", "대시보드", "실시간 현황"],
  ["livemap", "라이브 맵", "실시간 위치"],
  ["incidents", "사건 로그", "사건 관리"],
  ["devices", "디바이스", "웨어러블 관리"],
  ["reports", "리포트", "통계 & 분석"],
  ["settings", "설정", "시스템 설정"]
];

function apiUrl(pathname) {
  return apiBase ? `${apiBase}${pathname}` : pathname;
}
function person(id) {
  const [name, age] = people[(Number(id) - 1 + people.length) % people.length];
  return { name, age };
}
function guestById(id) {
  if (!id) return null;
  return guestOptions.find((guest) => Number(guest.id) === Number(id)) || null;
}
function assignedGuest(device) {
  return device?.assignedGuest || guestById(device?.assignedGuestId) || null;
}
function displayName(device) {
  return assignedGuest(device)?.name || device?.name || `센서${device?.id ?? "-"}`;
}
function displayAge(device) {
  return assignedGuest(device)?.age ?? null;
}
function beach(id) {
  return beaches[(Number(id) - 1 + beaches.length) % beaches.length];
}
function deviceBeach(device) {
  return beach(device?.assignedGuestId || device?.id || 1);
}
function guestPortrait(id) {
  const index = ((Number(id) - 1) % Object.keys(guestPortraits).length) + 1;
  return guestPortraits[index] || topProfileImage;
}
function devicePortrait(device) {
  const guest = assignedGuest(device);
  return guest ? guestPortrait(guest.id) : null;
}
function coach(id) {
  return coaches[(Number(id) - 1 + coaches.length) % coaches.length];
}
function battery(sensor) {
  if (sensor?.battery !== null && sensor?.battery !== undefined && !Number.isNaN(Number(sensor.battery))) {
    return Math.max(5, Math.min(100, Number(sensor.battery)));
  }
  return Math.max(18, Math.min(94, 33 + ((Number(sensor?.id || 1) * 19) % 61)));
}
function score(sensor) {
  if (!sensor) return 0;
  if (sensor.status === "danger") return 85;
  if (sensor.status === "warning") return sensor.finger === 0 ? 45 : 63;
  if (sensor.status === "offline") return 5;
  return Math.max(5, Math.min(38, Math.round(((Number(sensor.bpm) || 82) - 65) * 0.55)));
}
function priority(sensor) {
  if (sensor.status === "danger") return ["P1", "bg-[#e31414] text-white"];
  if (sensor.status === "warning") return ["P2", "bg-[#ffcf0f] text-white"];
  if (sensor.status === "offline") return ["P3", "bg-[#cbd5e1] text-[#475569]"];
  return ["P3", "bg-[#14a1e3] text-white"];
}
function statusText(status) {
  return status === "danger" ? "위험" : status === "warning" ? "주의" : status === "offline" ? "오프라인" : "양호";
}
function when(value) {
  if (!value) return "방금 전";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${Math.max(1, seconds)}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}
function fmt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}   ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function sortSensors(list) {
  const rank = { danger: 0, warning: 1, normal: 2, offline: 3 };
  return [...list].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || Number(a.id) - Number(b.id));
}
function marker(sensor) {
  const tone = sensor.status === "danger" ? "#e31414" : sensor.status === "warning" ? "#ffcf0f" : sensor.status === "offline" ? "#9ca3af" : "#14a1e3";
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;border-radius:999px;border:2px solid #fff;background:${tone};box-shadow:0 6px 16px rgba(15,37,60,.24)"></div>`
  });
}
function deviceAvailability(sensor) {
  if (sensor.status === "danger" || sensor.status === "offline") {
    return { label: "정비중", pillClass: "bg-[rgba(227,20,20,0.63)] text-white", iconColor: "#e31414" };
  }
  if (sensor.connected && sensor.assignedGuestId) {
    return { label: "대여중", pillClass: "bg-[rgba(5,64,103,0.49)] text-white", iconColor: sensor.status === "warning" ? "#ffcf0f" : "#29bf5b" };
  }
  if (sensor.connected) {
    return { label: "미할당", pillClass: "bg-[rgba(148,163,184,0.58)] text-white", iconColor: "#64748b" };
  }
  return { label: "사용가능", pillClass: "bg-[rgba(28,121,28,0.46)] text-white", iconColor: "#29bf5b" };
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [serial, setSerial] = useState({ connected: false, message: "연결 대기 중" });
  const [filter, setFilter] = useState("today");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("부산");
  const [guests, setGuests] = useState(guestOptions);

  async function refreshDevices() {
    const response = await fetch(apiUrl("/api/devices"));
    if (!response.ok) return;

    const list = await response.json();
    setDevices(list);
    setSelectedId((current) => current || String(list.find((item) => item.connected)?.id || list[0]?.id || ""));
  }

  async function assignDevice(deviceId, guestId) {
    const response = await fetch(apiUrl(`/api/devices/${deviceId}/assign`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: guestId || null })
    });

    if (!response.ok) {
      throw new Error("디바이스 할당 저장에 실패했습니다.");
    }

    await refreshDevices();
  }

  useEffect(() => {
    async function load() {
      try {
        const [d, i, c, g] = await Promise.all([
          fetch(apiUrl("/api/devices")),
          fetch(apiUrl("/api/incidents")),
          fetch(apiUrl("/api/collector/status")),
          fetch(apiUrl("/api/guests"))
        ]);

        if (d.ok) {
          const list = await d.json();
          setDevices(list);
          if (list[0]) setSelectedId(String(list.find((item) => item.connected)?.id || list[0].id));
        }
        if (i.ok) setIncidents(await i.json());
        if (c.ok) setSerial(await c.json());
        if (g.ok) setGuests(await g.json());
      } catch (error) {
        console.error(error);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const socket = io(socketUrl, { path: socketPath, transports: ["websocket", "polling"] });
    socket.on("initialState", refreshDevices);
    socket.on("sensorUpdate", refreshDevices);
    socket.on("deviceRegistered", refreshDevices);
    socket.on("deviceAssignmentChanged", refreshDevices);
    socket.on("serialStatus", setSerial);
    socket.on("disconnect", () => setSerial({ connected: false, message: "수집기 연결이 끊어졌습니다." }));
    return () => socket.disconnect();
  }, []);

  const ordered = sortSensors(devices);
  const connectedDevices = ordered.filter((item) => item.connected);
  const activeGuests = connectedDevices.filter((item) => item.assignedGuestId);
  const trackedDevices = connectedDevices.length ? connectedDevices : ordered;
  const selected = trackedDevices.find((item) => String(item.id) === String(selectedId)) || trackedDevices[0] || null;
  const alerts = activeGuests.filter((item) => item.status !== "normal" && item.status !== "offline");
  const shownIncidents = incidents
    .filter((item) => {
      if (filter === "all") return true;
      const date = new Date(item.created_at);
      const target = new Date();
      if (filter === "yesterday") target.setDate(target.getDate() - 1);
      return date.toDateString() === target.toDateString();
    })
    .filter((item) => !query.trim() || `${item.incident_id} ${item.description} ${item.type}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-transparent text-[#21272a]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[256px] flex-col bg-white px-4 pb-8 pt-6 transition-transform duration-200 xl:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex justify-center pb-8 pt-2">
          <BrandLogo className="w-[182px]" />
        </div>
        <nav className="flex flex-col">
          {nav.map(([key, title, subtitle]) => (
            <button key={key} className={`flex items-center gap-3 border-b border-[#f2f4f8] px-3 py-4 text-left ${page === key ? "rounded-[4px] bg-[#f2f4f8] shadow-soft" : "hover:bg-[#f8fafc]"}`} type="button" onClick={() => { setPage(key); setMobileNav(false); }}>
              <Icon name={key} />
              <div>
                <div className="text-[13px] font-medium leading-none">{title}</div>
                <div className="mt-1 text-[10px] leading-[1.42] text-[#8c8c8c]">{subtitle}</div>
              </div>
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-[12px] border border-[#e4e9f1] bg-[#f8fafc] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`h-[10px] w-[10px] rounded-full ${serial.connected ? "bg-[#18b26b] shadow-[0_0_0_4px_rgba(24,178,107,.16)]" : "bg-[#9ca3af]"}`} />
            <div>
              <div className="text-[12px] font-medium">연결 상태</div>
              <div className="mt-1 text-[10px] text-[#8c8c8c]">{serial.connected ? serial.port || "연결됨" : serial.message}</div>
            </div>
          </div>
        </div>
      </aside>

      {mobileNav ? <button type="button" className="fixed inset-0 z-20 bg-slate-900/30 xl:hidden" onClick={() => setMobileNav(false)} /> : null}

      <main className="relative xl:ml-[256px] xl:min-h-screen">
        <header className="mx-3 mt-3 flex items-center justify-between rounded-[16px] bg-white px-4 py-3 shadow-soft xl:hidden">
          <button type="button" onClick={() => setMobileNav(true)}><Icon name="menu" /></button>
          <div className="text-[14px] font-medium tracking-[0.08em] text-[#113f67]">MARINE GUARD</div>
          <span className={`h-2.5 w-2.5 rounded-full ${serial.connected ? "bg-[#18b26b]" : "bg-[#9ca3af]"}`} />
        </header>

        <div className="w-full px-3 pb-6 pt-3 md:px-5 md:pb-8 md:pt-5 xl:px-0 xl:pr-6 xl:pt-6">
          <div className="min-h-[785px] w-full rounded-[20px] bg-[#f2f4f8] px-4 py-[17px] shadow-panel xl:px-[16px]">
            <TopBar alerts={alerts} />
            {page === "dashboard" ? <Dashboard ordered={activeGuests} alerts={alerts} region={region} onRegion={setRegion} onSelect={(id) => { setSelectedId(String(id)); setPage("livemap"); }} /> : null}
            {page === "livemap" ? <LiveMap selected={selected} ordered={trackedDevices} region={region} onRegion={setRegion} onSelect={(id) => setSelectedId(String(id))} /> : null}
            {page === "incidents" ? <Incidents incidents={shownIncidents} filter={filter} query={query} onFilter={setFilter} onQuery={setQuery} /> : null}
            {page === "devices" ? <Devices ordered={ordered} guests={guests} onAssign={assignDevice} /> : null}
            {page === "reports" ? <Reports ordered={trackedDevices} incidents={incidents} /> : null}
            {page === "settings" ? <Settings serial={serial} /> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function TopBar({ alerts }) {
  const lead = alerts[0];
  const p = person(6);
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-h-[32px] items-center gap-3 rounded-[9px] bg-white px-3 py-2">
        <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white">
          <svg className="h-[18px] w-[18px] text-[#c7cbd1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 17H5L6.4 15.6C6.8 15.2 7 14.7 7 14.2V10.2C7 7.3 9 5 12 5C15 5 17 7.3 17 10.2V14.2C17 14.7 17.2 15.2 17.6 15.6L19 17H15Z" />
            <path d="M10.5 19C10.9 19.6 11.5 20 12.2 20C12.9 20 13.5 19.6 13.9 19" />
          </svg>
          <span className="absolute left-[4px] top-[3px] h-[6px] w-[6px] rounded-full bg-[#da1e28]" />
        </span>
        <div className="text-[11px] font-medium">{lead ? "이탈" : "정상"}</div>
        <div className="text-[10px] text-[#a1a1a1]">{lead ? `${person(lead.id).name} 님이 안전구역을 일시적으로 벗어났습니다` : "현재 시스템이 정상적으로 운영 중입니다"}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Avatar src={topProfileImage} label={p.name.slice(0, 1)} className="h-[31.5px] w-[31.5px] text-[11px]" />
        <div className="text-[11px] leading-[12px]">
          <div className="font-medium">홍길동</div>
          <div className="mt-0.5 text-[8px] text-[#a1a1a1]">hong@gmail.com</div>
        </div>
        <svg className="h-5 w-5 text-[#113f67]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 10L12 14L16 10" /></svg>
      </div>
    </div>
  );
}

function Dashboard({ ordered, alerts, region, onRegion, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[12px] px-[31px] py-[20px] text-white" style={{ backgroundImage: `linear-gradient(rgba(17,63,103,.24), rgba(17,63,103,.24)), url(${heroImage})`, backgroundPosition: "center", backgroundSize: "cover" }}>
        <div className="text-[17px] font-medium leading-[1.2]">해양안전 실시간 모니터링</div>
        <div className="mt-2 text-[13px] text-white/90">현재 {ordered.length}명의 게스트가 디바이스에 할당되어 추적 중입니다</div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(340px,1.02fr)_minmax(460px,1.63fr)]">
        <div className="rounded-[12px] bg-white px-[13px] pb-[14px] pt-[15px] shadow-soft">
          <div className="mb-[15px] text-[15px] font-medium">활성 게스트</div>
          {ordered.length ? (
            <div className="grid max-h-[306px] gap-[6px] overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{ordered.slice(0, 8).map((sensor) => <GuestRow key={sensor.id} sensor={sensor} onClick={() => onSelect(sensor.id)} />)}</div>
          ) : (
            <div className="flex h-[306px] items-center justify-center rounded-[9px] bg-[#f8fafc] text-[12px] text-[#8c8c8c]">할당된 연결 디바이스가 없어 활성 게스트가 없습니다.</div>
          )}
        </div>
        <div className="rounded-[12px] bg-white px-[13px] pb-[15px] pt-[10px] shadow-soft">
          <div className="mb-[13px] flex items-center justify-between">
            <div className="text-[15px] font-medium">라이브 맵</div>
            <RegionSelect value={region} onChange={onRegion} size="sm" />
          </div>
          <div className="h-[266px] overflow-hidden rounded-[9px]"><MapBox sensors={ordered} zoom={12} /></div>
        </div>
      </div>
      <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
        <div className="mb-4 text-[15px] font-medium">알림</div>
        {alerts.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{alerts.map((sensor) => <AlertCard key={sensor.id} sensor={sensor} />)}</div>
        ) : (
          <div className="flex h-[131px] items-center justify-center rounded-[9px] bg-[#f8fafc] text-[12px] text-[#8c8c8c]">현재 경고 상태의 할당 디바이스가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function LiveMap({ selected, ordered, region, onRegion, onSelect }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(520px,1.58fr)_minmax(320px,1fr)]">
      <div className="rounded-[12px] bg-white px-[13px] pb-[16px] pt-[12px] shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-medium">라이브 맵</div>
          <RegionSelect value={region} onChange={onRegion} />
        </div>
        <div className="h-[638px] overflow-hidden rounded-[9px]"><MapBox sensors={ordered} zoom={13} focus={selected} /></div>
      </div>
      <div className="flex flex-col gap-[13px]">
        <div className="rounded-[12px] bg-white px-[13px] pb-[13px] pt-[15px] shadow-soft">
          <div className="text-[15px] font-medium">선택된 디바이스</div>
          <div className="mt-4 rounded-[9px] bg-[#f8fafc] px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar src={selected ? devicePortrait(selected) : null} label={selected ? displayName(selected).slice(0, 1) : "-"} />
              <div className="text-[11px] leading-[12px]">
                <div className="font-medium">{selected ? displayName(selected) : "선택된 디바이스 없음"}</div>
                <div className="mt-1 text-[#a1a1a1]">마지막 업데이트 : {selected ? when(selected.lastUpdate) : "-"}</div>
              </div>
              <MoreDots className="ml-auto h-4 w-4 text-[#a1a1a1]" />
            </div>
          </div>
        </div>
        <button type="button" className="h-[28px] rounded-[18px] bg-[#e2e2e2] text-[10px] text-[#8c8c8c]">요원 긴급 배정</button>
        <div className="grid gap-[13px] sm:grid-cols-2">
          <Panel title="위험 스코어"><Gauge value={score(selected)} /></Panel>
          <Panel title="심박수"><Heart bpm={selected?.finger === 0 ? "---" : `${selected?.bpm || "---"}bpm`} /></Panel>
        </div>
        <Panel title="배터리"><BatteryWave level={battery(selected)} /></Panel>
        <div className="rounded-[12px] bg-white px-[13px] pb-[13px] pt-[15px] shadow-soft">
          <div className="mb-3 text-[13px] font-medium">연결 디바이스 목록</div>
          {ordered.length ? (
            <div className="grid gap-2 sm:grid-cols-2">{ordered.slice(0, 10).map((sensor) => <Compact key={sensor.id} sensor={sensor} onClick={() => onSelect(String(sensor.id))} />)}</div>
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-[9px] bg-[#f8fafc] text-[12px] text-[#8c8c8c]">현재 연결된 디바이스가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Incidents({ incidents, filter, query, onFilter, onQuery }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="pt-[4px] text-[15px] font-medium leading-[16px]">사건 로그</div>
        <div className="flex flex-wrap items-center gap-[10px] sm:justify-end">
          <div className="flex gap-[6px]">
            <button type="button" className={`h-[22px] rounded-[6px] border px-[14px] text-[10px] ${filter === "yesterday" ? "border-[#b0b0b0] bg-white text-[#616161]" : "border-[#dbdbdb] bg-white text-[#616161]"}`} onClick={() => onFilter("yesterday")}>어제</button>
            <button type="button" className={`h-[22px] rounded-[6px] px-[14px] text-[10px] ${filter === "today" ? "bg-[#054067] text-white" : "border border-[#dbdbdb] bg-white text-[#616161]"}`} onClick={() => onFilter("today")}>오늘</button>
          </div>
          <label className="flex h-[22px] w-full items-center gap-2 rounded-[6px] border border-[#dbdbdb] bg-white px-3 text-[10px] text-[#a1a1a1] sm:w-[154px]">
            <Search />
            <input className="w-[160px] border-0 bg-transparent p-0 text-[10px] outline-none" placeholder="검색..." value={query} onChange={(event) => onQuery(event.target.value)} />
          </label>
        </div>
      </div>
      <div className="flex max-h-[629px] flex-col gap-[7px] overflow-auto pr-1">{incidents.map((incident) => <IncidentCard key={incident.incident_id} incident={incident} />)}</div>
    </div>
  );
}

function Devices({ ordered, guests, onAssign }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = ordered.filter((sensor) => {
    if (statusFilter === "assigned" && !sensor.assignedGuestId) return false;
    if (statusFilter === "available" && sensor.connected) return false;
    if (statusFilter === "maintenance" && sensor.status !== "danger" && sensor.status !== "offline") return false;
    if (!search.trim()) return true;

    const term = search.trim().toLowerCase();
    return `${sensor.id} ${sensor.name} ${displayName(sensor)} ${sensor.receiverLabel || ""}`.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[13px] font-medium leading-[16px]">웨어러블 기기 목록</div>
          <div className="mt-[3px] text-[10px] text-[#b5b5b6]">송수신기 연결 상태와 게스트 할당을 관리합니다</div>
        </div>
        <div className="flex flex-wrap items-center gap-[9px] lg:justify-end">
          <div className="flex h-[25px] items-center gap-[2px] rounded-[12px] bg-[#f2f4f8] px-[4px]">
            <button type="button" className={`h-[19px] rounded-[9.5px] px-[18px] text-[9px] ${statusFilter === "all" ? "bg-white text-[#21272a]" : "text-[#21272a]"}`} onClick={() => setStatusFilter("all")}>전체</button>
            <button type="button" className={`px-[14px] text-[9px] ${statusFilter === "assigned" ? "rounded-[9.5px] bg-white text-[#21272a]" : "text-[#21272a]"}`} onClick={() => setStatusFilter("assigned")}>대여중</button>
            <button type="button" className={`px-[10px] text-[9px] ${statusFilter === "available" ? "rounded-[9.5px] bg-white text-[#21272a]" : "text-[#21272a]"}`} onClick={() => setStatusFilter("available")}>사용가능</button>
            <button type="button" className={`px-[14px] text-[9px] ${statusFilter === "maintenance" ? "rounded-[9.5px] bg-white text-[#21272a]" : "text-[#21272a]"}`} onClick={() => setStatusFilter("maintenance")}>정비</button>
          </div>
          <label className="flex h-[22px] w-full items-center gap-2 rounded-[6px] border border-[#dbdbdb] bg-white px-3 text-[10px] text-[#a1a1a1] sm:w-[190px]"><Search /><input className="w-full border-0 bg-transparent p-0 text-[10px] outline-none" placeholder="디바이스 / 게스트 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
      </div>
      {filtered.length ? (
        <div className="grid gap-[6px] md:grid-cols-2 xl:grid-cols-[repeat(4,1fr)]">{filtered.slice(0, 12).map((sensor) => <Device key={sensor.id} sensor={sensor} guests={guests} onAssign={onAssign} />)}</div>
      ) : (
        <div className="flex h-[220px] items-center justify-center rounded-[15px] bg-white text-[12px] text-[#8c8c8c] shadow-soft">조건에 맞는 디바이스가 없습니다.</div>
      )}
    </div>
  );
}

function Reports({ ordered, incidents }) {
  const danger = ordered.filter((sensor) => sensor.status === "danger").length;
  const warning = ordered.filter((sensor) => sensor.status === "warning").length;
  const normal = Math.max(ordered.length - warning - danger, 0);
  const active = incidents.filter((incident) => incident.status === "active").length;
  const resolved = incidents.filter((incident) => incident.status === "resolved").length;
  const trend = [0.48, 0.56, 0.61, 0.58, 0.7, 0.84, 0.78].map((ratio, index) => {
    const live = ordered.length || 8;
    return Math.max(2, Math.round(live * ratio) + (index === 4 ? warning : 0) + (index === 5 ? danger : 0));
  });
  const trendMax = Math.max(...trend, 1);
  const trendPoints = trend.map((value, index) => ({
    x: 36 + index * 88,
    y: 216 - (value / trendMax) * 146
  }));
  const trendLine = trendPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const trendArea = `${trendLine} L ${trendPoints[trendPoints.length - 1].x} 216 L ${trendPoints[0].x} 216 Z`;
  const incidentBars = [
    { label: "위험", value: Math.max(danger, 1), color: "#e31414" },
    { label: "주의", value: Math.max(warning, 1), color: "#ffcf0f" },
    { label: "진행", value: Math.max(active, 1), color: "#14a1e3" },
    { label: "완료", value: Math.max(resolved, 1), color: "#113f67" }
  ];
  const incidentMax = Math.max(...incidentBars.map((item) => item.value), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[28px] font-medium leading-none">리포트</div>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="총 게스트"><div className="text-[42px] font-medium">{ordered.length}</div></Panel>
        <Panel title="주의 상태"><div className="text-[42px] font-medium text-[#113f67]">{warning}</div></Panel>
        <Panel title="오늘 사건"><div className="text-[42px] font-medium text-[#e31414]">{incidents.length}</div></Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(260px,0.78fr)]">
        <Panel title="상태 분포">
          <div className="rounded-[12px] bg-[#f7f9fc] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[10px] bg-white px-4 py-3">
                <div className="text-[10px] text-[#8c8c8c]">정상</div>
                <div className="mt-2 text-[24px] font-medium text-[#14a1e3]">{normal}</div>
              </div>
              <div className="rounded-[10px] bg-white px-4 py-3">
                <div className="text-[10px] text-[#8c8c8c]">주의</div>
                <div className="mt-2 text-[24px] font-medium text-[#ffb100]">{warning}</div>
              </div>
              <div className="rounded-[10px] bg-white px-4 py-3">
                <div className="text-[10px] text-[#8c8c8c]">위험</div>
                <div className="mt-2 text-[24px] font-medium text-[#e31414]">{danger}</div>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-[12px] bg-white px-4 py-3">
              <svg viewBox="0 0 600 240" className="h-[240px] w-full">
                {[0, 1, 2, 3].map((step) => <line key={step} x1="24" x2="576" y1={52 + step * 41} y2={52 + step * 41} stroke="#e9edf4" strokeWidth="1" />)}
                <path d={trendArea} fill="rgba(20,161,227,0.14)" />
                <path d={trendLine} fill="none" stroke="#14a1e3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {trendPoints.map((point, index) => (
                  <g key={index}>
                    <circle cx={point.x} cy={point.y} r="6" fill="#ffffff" stroke="#14a1e3" strokeWidth="3" />
                    <text x={point.x} y="232" textAnchor="middle" fill="#8c8c8c" fontSize="11">{`${index + 9}시`}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </Panel>
        <Panel title="사건 현황">
          <div className="flex h-full min-h-[365px] flex-col rounded-[12px] bg-[#f7f9fc] p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[10px] bg-white px-4 py-3">
                <div className="text-[10px] text-[#8c8c8c]">진행중 사건</div>
                <div className="mt-2 text-[24px] font-medium text-[#113f67]">{active}</div>
              </div>
              <div className="rounded-[10px] bg-white px-4 py-3">
                <div className="text-[10px] text-[#8c8c8c]">처리 완료</div>
                <div className="mt-2 text-[24px] font-medium text-[#14a1e3]">{resolved}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-1 items-end gap-3">
              {incidentBars.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-[12px]" style={{ height: `${Math.max(42, (item.value / incidentMax) * 170)}px`, background: item.color }} />
                  <div className="text-center">
                    <div className="text-[11px] font-medium">{item.value}</div>
                    <div className="mt-1 text-[10px] text-[#8c8c8c]">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Settings({ serial }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[28px] font-medium leading-none">설정</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="수집기 연결"><div className="text-[24px] font-medium">{serial.connected ? "온라인" : "오프라인"}</div><div className="mt-2 text-[12px] text-[#8c8c8c]">{serial.message}</div></Panel>
        <Panel title="프론트엔드 전환"><div className="text-[24px] font-medium">React + Tailwind</div><div className="mt-2 text-[12px] text-[#8c8c8c]">Figma 기준 화면 구조로 재구성된 상태입니다.</div></Panel>
      </div>
    </div>
  );
}

function MapBox({ sensors, zoom, focus }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView([35.1595, 129.1603], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.current = new Map();
    };
  }, [zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    sensors.forEach((sensor) => {
      if (!Number(sensor.lat) || !Number(sensor.lon)) return;
      const key = String(sensor.id);
      const pos = [Number(sensor.lat), Number(sensor.lon)];
      const existing = markers.current.get(key);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(marker(sensor));
      } else {
        const created = L.marker(pos, { icon: marker(sensor) }).addTo(map).bindPopup(`<strong>${displayName(sensor)}</strong><br>${deviceBeach(sensor)}<br>${statusText(sensor.status)}`);
        markers.current.set(key, created);
      }
    });
    if (focus && Number(focus.lat) && Number(focus.lon)) {
      map.setView([Number(focus.lat), Number(focus.lon)], 14);
      markers.current.get(String(focus.id))?.openPopup();
      return;
    }
    const points = sensors.filter((sensor) => Number(sensor.lat) && Number(sensor.lon)).map((sensor) => [Number(sensor.lat), Number(sensor.lon)]);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: zoom });
  }, [focus, sensors, zoom]);

  return <div ref={ref} className="h-full w-full" />;
}

function GuestRow({ sensor, onClick }) {
  const p = assignedGuest(sensor) || { name: displayName(sensor), age: displayAge(sensor) };
  const [label, style] = priority(sensor);
  return (
    <button type="button" className="flex items-center gap-[13px] rounded-[9px] bg-[#f2f4f8] px-[15.5px] py-[5.5px] text-left" onClick={onClick}>
      <Avatar src={devicePortrait(sensor)} label={p.name.slice(0, 1)} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-[18px]">{p.name} {p.age ? <span className="text-[11px] font-normal text-[#a1a1a1]">{p.age}세</span> : null}</div>
        <div className="mt-1 inline-flex items-center gap-2"><span className={`inline-flex min-w-[20px] justify-center px-[5px] py-px text-[8px] ${style}`}>{label}</span></div>
      </div>
      <BatteryIcon level={battery(sensor)} className="h-[24px] w-[24px] rotate-90" />
    </button>
  );
}

function AlertCard({ sensor }) {
  const p = assignedGuest(sensor) || { name: displayName(sensor) };
  const [label, style] = priority(sensor);
  const headline = sensor.status === "danger" ? `심박수 ${sensor.bpm || 185}bpm, HRV 급락 감지` : sensor.finger === 0 ? "안전구역을 벗어남" : "지속적 고심박, 휴식 필요";
  return (
    <article className="min-h-[131px] w-full rounded-[9px] bg-[#f2f4f8] px-6 py-4">
      <span className={`inline-flex min-w-[20px] justify-center px-[5px] py-px text-[8px] ${style}`}>{label}</span>
      <div className="mt-[10px] text-center text-[18px] font-medium">{p.name}</div>
      <div className="mt-1 text-center text-[11px] text-[#a1a1a1]">{deviceBeach(sensor)} / 위험스코어 {score(sensor)}</div>
      <div className="mt-[10px] text-center text-[13px] leading-[1.45]">{headline}</div>
      <div className="mt-[11px] flex items-center justify-center gap-5 text-[10px] text-[#8c8c8c]"><span>{when(sensor.lastUpdate)}</span><span>{deviceBeach(sensor)}</span></div>
    </article>
  );
}

function Compact({ sensor, onClick }) {
  return (
    <button type="button" className="grid min-h-[43px] grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 border border-[#cccfd4] bg-[#fcfcfd] px-[8px] py-[10px] text-left" onClick={onClick}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: sensor.status === "danger" ? "#e31414" : sensor.status === "warning" ? "#ffcf0f" : sensor.status === "offline" ? "#9ca3af" : "#14a1e3" }} />
      <div><div className="text-[10px] font-medium leading-[1]">{displayName(sensor)}</div><div className="mt-[3px] text-[7px] leading-[1] text-[#a1a1a1]">{sensor.bpm || 0}bpm</div></div>
      <div className="text-right text-[10px] font-medium">{score(sensor)}<span className="ml-[1px] text-[7px] text-[#a1a1a1]">점</span></div>
    </button>
  );
}

function IncidentCard({ incident }) {
  const p = person(incident.sensor_id || 1);
  const status = incident.status === "active" ? ["진행중", "bg-[#20b2aa] text-white"] : incident.status === "resolved" ? ["처리완료", "bg-[#113f67] text-white"] : ["오탐", "bg-[#ececec] text-[#666]"];
  const urgency = incident.status === "active" ? ["P1", "bg-[#e31414]"] : ["P2", "bg-[#ffcf0f]"];
  const minutes = Math.max(2, Number(String(incident.incident_id).slice(-2)) || 8);
  return (
    <article className="rounded-[9px] bg-[#f2f4f8] px-[12px] pb-[10px] pt-[7px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-[6px]">
          <span className={`mt-3 inline-flex h-[12px] min-w-[20px] items-center justify-center text-[8px] text-white ${urgency[1]}`}>{urgency[0]}</span>
          <div>
            <div className="text-[13px] font-medium leading-[18px]">{incident.incident_id}</div>
            <div className="text-[11px] leading-[18px] text-[#a1a1a1]">{p.name} / {incident.type || "과부하"}</div>
          </div>
        </div>
        <span className={`mt-[11px] inline-flex h-[14px] min-w-[38px] items-center justify-center rounded-[0px] px-[4px] text-[8px] font-bold ${status[1]}`}>{status[0]}</span>
      </div>
      <div className="mt-[10px] text-[13px] leading-[18px]">{incident.description || "안전구역을 벗어남"}</div>
      <div className="mt-[13px] flex flex-wrap items-center gap-[12px] text-[9px] text-[#a1a1a1]">
        <span>{fmt(incident.created_at).replace(" ", "   ")}</span>
        <span>{beach(incident.sensor_id || 1)}</span>
        <span>{minutes}분</span>
        <span>{coach(incident.sensor_id || 1)}</span>
      </div>
    </article>
  );
}

function Device({ sensor, guests, onAssign }) {
  const level = battery(sensor);
  const availability = deviceAvailability(sensor);
  const assignee = assignedGuest(sensor)?.name || "미할당";
  const statusClass = sensor.status === "danger" || sensor.status === "offline" ? "text-[#e31414]" : sensor.status === "warning" ? "text-[#054067]" : "text-[#054067]";
  return (
    <article className="rounded-[15px] bg-[#f2f4f8] px-[16px] pb-[8px] pt-[10px] shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12.5px] font-medium leading-[15px]">Ocean Guard {sensor.id}</div>
          <div className="mt-[4px] text-[12.5px] font-light leading-[15px] text-[#a1a1a1]">{sensor.receiverLabel || "송수신기 연결 대기"}</div>
        </div>
        <div className="flex items-end gap-[1.5px] pt-[1px]">
          <span className="h-[5px] w-[2px] rounded-full" style={{ background: availability.iconColor, opacity: 0.55 }} />
          <span className="h-[7px] w-[2px] rounded-full" style={{ background: availability.iconColor, opacity: 0.75 }} />
          <span className="h-[9px] w-[2px] rounded-full" style={{ background: availability.iconColor }} />
        </div>
      </div>
      <div className="mt-[10px] flex items-center justify-between text-[7.5px] text-[#5c5c5c]">
        <span className={`inline-flex h-[11px] min-w-[24px] items-center justify-center px-[4px] text-[5.8px] font-semibold ${availability.pillClass}`}>{availability.label}</span>
        <span>{level}%</span>
      </div>
      <div className="mt-[4px]">
        <div className="h-[3.8px] rounded-[11px] bg-white">
          <div className="h-[3.8px] rounded-[11px] bg-[#054067]" style={{ width: `${level}%` }} />
        </div>
      </div>
      <div className="mt-[8px] flex items-center justify-between text-[8.7px]">
        <span className="text-[#919191]">배터리</span>
        <span className={statusClass}>{statusText(sensor.status)}</span>
      </div>
      <div className="mt-[9px] rounded-[10px] bg-[rgba(255,255,255,0.52)] px-[11px] py-[8px] text-[8.7px] text-[#21272a]">
        <div className="flex items-center gap-2">
          <span className={sensor.connected ? "text-[#29bf5b]" : "text-[#a1a1a1]"}>{sensor.connected ? "◉" : "◎"}</span>
          <span className={sensor.connected ? "" : "text-[#a1a1a1]"}>{assignee}</span>
        </div>
        <label className="mt-[7px] flex items-center gap-2 text-[8.7px] text-[#6b7280]">
          <span className="shrink-0">게스트</span>
          <select className="h-[22px] w-full rounded-[7px] border border-[#d6dce5] bg-white px-2 text-[9px] text-[#21272a] outline-none" value={sensor.assignedGuestId || ""} onChange={(event) => onAssign(sensor.id, event.target.value ? Number(event.target.value) : null)}>
            <option value="">미할당</option>
            {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
          </select>
        </label>
      </div>
    </article>
  );
}

function Panel({ title, children }) {
  return <div className="rounded-[12px] bg-white p-[13px] shadow-soft"><div className="text-[13px] font-medium">{title}</div><div className="mt-4">{children}</div></div>;
}

function Gauge({ value }) {
  const display = value || "--";
  const arc = Math.max(0, Math.min(100, Number(value) || 0));
  const circumference = 170;
  const offset = circumference - (arc / 100) * circumference;
  return (
    <div className="flex justify-center py-2">
      <svg viewBox="0 0 128 110" className="h-[112px] w-[128px]" aria-hidden="true">
        <path d="M24 87 A40 40 0 1 1 104 87" fill="none" stroke="#dfe1e6" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M24 87 A40 40 0 1 1 104 87"
          fill="none"
          stroke={arc > 66 ? "#e31414" : arc > 33 ? "#ffcf0f" : "#14a1e3"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
        <text x="64" y="80" textAnchor="middle" fontSize="20" fontWeight="600" fill="#525252">{display}</text>
        <text x="64" y="96" textAnchor="middle" fontSize="11" fontWeight="600" fill="#525252">점</text>
      </svg>
    </div>
  );
}

function Heart({ bpm }) {
  return (
    <div className="flex justify-center py-2">
      <svg viewBox="0 0 132 118" className="h-[118px] w-[132px]" aria-hidden="true">
        <path d="M66 107C53 97 28 78 17 60C8 45 11 25 28 18C43 12 56 21 66 34C76 21 89 12 104 18C121 25 124 45 115 60C104 78 79 97 66 107Z" fill="#f0f3f8" />
        <text x="66" y="66" textAnchor="middle" fontSize="18" fontWeight="600" fill="#525252">{bpm}</text>
      </svg>
    </div>
  );
}

function BatteryWave({ level }) {
  const x = Math.max(18, Math.min(315, (Number(level) || 0) * 3.15));
  return (
    <div className="overflow-hidden rounded-[9px] bg-[#f5f7fb] px-3 py-[11px]">
      <svg viewBox="0 0 333 49" className="h-[49px] w-full" aria-hidden="true">
        <path d="M0 38C24 38 36 30 52 30C69 30 80 36 93 36V49H0V38Z" fill="#edf1f7" />
        <path d="M84 29C108 29 120 20 139 20C157 20 172 28 186 28V49H84V29Z" fill="#e8edf5" />
        <path d="M167 18C193 18 206 8 228 8C247 8 263 19 279 19V49H167V18Z" fill="#e4e9f1" />
        <path d="M250 10C273 10 289 3 309 3C320 3 327 4 333 4V49H250V10Z" fill="#e1e7f0" />
        <path d={`M0 38C24 38 36 30 52 30C69 30 80 36 93 36V49H0V38Z M84 29C108 29 120 20 139 20C157 20 172 28 186 28V49H84V29Z M167 18C193 18 206 8 228 8C247 8 263 19 279 19V49H167V18Z M250 10C273 10 289 3 309 3C320 3 327 4 333 4V49H250V10Z`} fill="none" stroke="#f7f9fc" strokeWidth="1.2" />
        <rect x="0" y="0" width={x} height="49" fill="rgba(20,161,227,0.08)" />
      </svg>
    </div>
  );
}

function Chip({ active = false, children, onClick = () => {} }) {
  return <button type="button" className={`rounded-[8px] border px-4 py-1.5 text-[10px] ${active ? "border-[#113f67] bg-[#113f67] text-white" : "border-[#dfe4eb] bg-white text-[#666]"}`} onClick={onClick}>{children}</button>;
}

function RegionSelect({ value, onChange, size = "md" }) {
  const [open, setOpen] = useState(false);
  const buttonClass = size === "sm" ? "h-[24px] min-w-[101px] px-4 text-[10px]" : "h-[30px] min-w-[101px] px-4 text-[10px]";

  return (
    <div className="relative">
      <button type="button" className={`flex items-center justify-between rounded-[18px] border border-[#e4e9f1] bg-white ${buttonClass}`} onClick={() => setOpen((current) => !current)}>
        <span>{value}</span>
        <svg className={`h-4 w-4 text-[#21272a] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 10L12 14L16 10" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-10 w-[111px] overflow-hidden rounded-[18px] bg-white shadow-[1px_4px_4px_rgba(0,0,0,0.25)]">
          {regions.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`flex h-[26px] w-full items-center justify-center bg-white text-[10px] text-[#808080] ${index < regions.length - 1 ? "border-b border-[rgba(0,0,0,0.1)]" : ""} ${item === value ? "font-semibold" : ""}`}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ label, src, className = "" }) {
  if (src) {
    return <img alt="" className={`h-[37.5px] w-[37.5px] rounded-full object-cover ${className}`} src={src} />;
  }

  const tones = ["from-[#1f5a82] to-[#2aa9b5]", "from-[#f39c6b] to-[#d87553]", "from-[#4f81c7] to-[#224f8a]", "from-[#b1b6bf] to-[#eceff4]"];
  return <div className={`flex h-[37.5px] w-[37.5px] items-center justify-center rounded-full bg-gradient-to-br text-[14px] font-medium text-white ${tones[0]} ${className}`}>{label}</div>;
}

function BatteryIcon({ level, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-x-[8px] bottom-[4px] top-[7px] rounded-[1px] border border-[#054067]" />
      <div className="absolute left-[9px] right-[9px] top-[10px] h-[8px] rounded-[0.8px] bg-[#2dabb3]" style={{ opacity: Math.max(0.25, level / 100) }} />
      <div className="absolute left-[9px] right-[9px] top-[4px] h-[3px] rounded-t-[1px] bg-[#054067]" />
    </div>
  );
}

function MoreDots({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function BrandLogo({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 183 94" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(66 2) scale(0.88)">
        <path d="M29 4L47 10V28C47 40.2 38.2 50.4 26.2 53.1L23.8 53.6L23.6 50.3C23 39.3 14.9 30.4 4 28.6V10L29 4Z" fill="#11658A" />
        <path d="M45.3 15C41.8 14.7 37.9 15.8 34.2 18.2C28.4 22 22.2 21.5 16.2 16.7L14 15L12.5 17.5C11.8 18.7 11.2 20 10.8 21.4C16.4 25.4 22.7 26.4 28.6 24.4C33.2 22.8 36.4 19.5 39.9 18.5C41.8 17.9 43.7 17.9 45.7 18.6L45.3 15Z" fill="#54C7D7" />
        <path d="M16.3 27.9C19.8 31.4 24 33.6 28.5 34.2C35.6 35.2 42.8 32.4 47 27.2V22.5C43.8 28.2 37.6 31.7 31 31.4C25.3 31.2 20.1 28.3 16.3 23.4V27.9Z" fill="#E8FAFF" />
      </g>
      <text x="91.5" y="82" textAnchor="middle" fill="#0d6381" fontFamily="Georgia, 'Times New Roman', serif" fontSize="24" letterSpacing="0.04em">MARINE GUARD</text>
    </svg>
  );
}

function Search() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>;
}

function Icon({ name }) {
  const base = "h-5 w-5 shrink-0 text-[#21272a]";
  if (name === "menu") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6H21" /><path d="M3 12H21" /><path d="M3 18H21" /></svg>;
  if (name === "dashboard") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>;
  if (name === "livemap") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" /><path d="M9 3V18" /><path d="M15 6V21" /></svg>;
  if (name === "incidents") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3H7A2 2 0 0 0 5 5V19A2 2 0 0 0 7 21H17A2 2 0 0 0 19 19V8Z" /><path d="M14 3V8H19" /><path d="M8 13H16" /><path d="M8 17H13" /></svg>;
  if (name === "devices") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 7H14" /><circle cx="12" cy="17" r="1" /></svg>;
  if (name === "reports") return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19H20" /><path d="M7 16V11" /><path d="M12 16V6" /><path d="M17 16V9" /></svg>;
  return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15A1.65 1.65 0 0 0 20 16.6L20.1 16.7A2 2 0 1 1 17.3 19.5L17.2 19.4A1.65 1.65 0 0 0 15.6 18.8A1.65 1.65 0 0 0 14.6 20.3V20.5A2 2 0 1 1 10.6 20.5V20.3A1.65 1.65 0 0 0 9.5 18.8A1.65 1.65 0 0 0 8 19.4L7.9 19.5A2 2 0 0 1 5.1 16.7L5.2 16.6A1.65 1.65 0 0 0 5.8 15A1.65 1.65 0 0 0 4.3 14H4A2 2 0 1 1 4 10H4.3A1.65 1.65 0 0 0 5.8 9A1.65 1.65 0 0 0 5.2 7.4L5.1 7.3A2 2 0 1 1 7.9 4.5L8 4.6A1.65 1.65 0 0 0 9.5 5.2A1.65 1.65 0 0 0 10.6 3.7V3.5A2 2 0 1 1 14.6 3.5V3.7A1.65 1.65 0 0 0 15.6 5.2A1.65 1.65 0 0 0 17.2 4.6L17.3 4.5A2 2 0 1 1 20.1 7.3L20 7.4A1.65 1.65 0 0 0 19.4 9A1.65 1.65 0 0 0 20.9 10H21A2 2 0 1 1 21 14H20.9A1.65 1.65 0 0 0 19.4 15Z" /></svg>;
}
