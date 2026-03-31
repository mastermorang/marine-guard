import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";

const runtimeConfig = window.MARINE_GUARD_CONFIG || {};
const apiBase = (runtimeConfig.apiBase || "").replace(/\/$/, "");
const socketUrl = runtimeConfig.socketUrl || apiBase || window.location.origin;
const socketPath = runtimeConfig.socketPath || "/socket.io";
const heroImage = "https://www.figma.com/api/mcp/asset/9f6230eb-0993-4d4b-89cd-12762e677c3f";

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
const beaches = ["송정해수욕장", "광안리해수욕장", "다대포해수욕장", "경포해수욕장", "중문해수욕장", "협재해수욕장"];
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
function beach(id) {
  return beaches[(Number(id) - 1 + beaches.length) % beaches.length];
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

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [sensors, setSensors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [serial, setSerial] = useState({ connected: false, message: "연결 대기 중" });
  const [filter, setFilter] = useState("today");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("부산");

  useEffect(() => {
    async function load() {
      try {
        const [s, i, c] = await Promise.all([fetch(apiUrl("/api/sensors")), fetch(apiUrl("/api/incidents")), fetch(apiUrl("/api/collector/status"))]);
        if (s.ok) {
          const list = await s.json();
          setSensors(list);
          if (list[0]) setSelectedId(String(list[0].id));
        }
        if (i.ok) setIncidents(await i.json());
        if (c.ok) setSerial(await c.json());
      } catch (error) {
        console.error(error);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const socket = io(socketUrl, { path: socketPath, transports: ["websocket", "polling"] });
    socket.on("initialState", (list) => {
      setSensors(list);
      setSelectedId((current) => current || String(list[0]?.id || ""));
    });
    socket.on("sensorUpdate", (sensor) => {
      setSensors((current) => {
        const next = [...current];
        const index = next.findIndex((item) => String(item.id) === String(sensor.id));
        if (index >= 0) next[index] = sensor;
        else next.push(sensor);
        return next;
      });
    });
    socket.on("serialStatus", setSerial);
    socket.on("disconnect", () => setSerial({ connected: false, message: "수집기 연결이 끊어졌습니다." }));
    return () => socket.disconnect();
  }, []);

  const ordered = sortSensors(sensors);
  const selected = ordered.find((item) => String(item.id) === String(selectedId)) || ordered[0] || null;
  const alerts = ordered.filter((item) => item.status !== "normal" && item.status !== "offline");
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
        <div className="flex flex-col items-center gap-2 pb-8 pt-2">
          <Logo className="h-[58px] w-[58px]" />
          <div className="font-serif text-[23px] tracking-[-0.03em] text-[#0d6381]">MARINE GUARD</div>
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

      <main className="relative xl:ml-[256px]">
        <header className="mx-3 mt-3 flex items-center justify-between rounded-[16px] bg-white px-4 py-3 shadow-soft xl:hidden">
          <button type="button" onClick={() => setMobileNav(true)}><Icon name="menu" /></button>
          <div className="text-[14px] font-medium tracking-[0.08em] text-[#113f67]">MARINE GUARD</div>
          <span className={`h-2.5 w-2.5 rounded-full ${serial.connected ? "bg-[#18b26b]" : "bg-[#9ca3af]"}`} />
        </header>

        <div className="mx-auto max-w-[1033px] px-3 pb-6 pt-3 md:px-5 md:pb-8 md:pt-5 xl:px-6">
          <div className="rounded-[20px] bg-[#f2f4f8] px-4 py-4 shadow-panel">
            <TopBar alerts={alerts} />
            {page === "dashboard" ? <Dashboard ordered={ordered} alerts={alerts} onSelect={(id) => { setSelectedId(String(id)); setPage("livemap"); }} /> : null}
            {page === "livemap" ? <LiveMap selected={selected} ordered={ordered} region={region} onRegion={setRegion} onSelect={(id) => setSelectedId(String(id))} /> : null}
            {page === "incidents" ? <Incidents incidents={shownIncidents} filter={filter} query={query} onFilter={setFilter} onQuery={setQuery} /> : null}
            {page === "devices" ? <Devices ordered={ordered} /> : null}
            {page === "reports" ? <Reports ordered={ordered} incidents={incidents} /> : null}
            {page === "settings" ? <Settings serial={serial} /> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function TopBar({ alerts }) {
  const lead = alerts[0];
  const p = person(1);
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-h-[32px] items-center gap-3 rounded-[9px] bg-white px-3 py-2">
        <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white">
          <span className="absolute left-[5px] top-[4px] h-[6px] w-[6px] rounded-full bg-[#e31414]" />
          <span className="h-[8px] w-[8px] rounded-full bg-[#cbd5e1]" />
        </span>
        <div className="text-[11px] font-medium">{lead ? "이탈" : "정상"}</div>
        <div className="text-[10px] text-[#a1a1a1]">{lead ? `${person(lead.id).name} 님이 안전구역을 일시적으로 벗어났습니다` : "현재 시스템이 정상적으로 운영 중입니다"}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Avatar label={p.name.slice(0, 1)} tone={1} className="h-[31.5px] w-[31.5px] text-[11px]" />
        <div className="text-[11px] leading-[12px]">
          <div className="font-medium">{p.name}</div>
          <div className="mt-0.5 text-[8px] text-[#a1a1a1]">hong@gmail.com</div>
        </div>
        <svg className="h-5 w-5 text-[#113f67]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 10L12 14L16 10" /></svg>
      </div>
    </div>
  );
}

function Dashboard({ ordered, alerts, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[12px] px-7 py-6 text-white" style={{ backgroundImage: `linear-gradient(rgba(17,63,103,.24), rgba(17,63,103,.24)), url(${heroImage})`, backgroundPosition: "center", backgroundSize: "cover" }}>
        <div className="text-[17px] font-medium leading-[1.2]">해양안전 실시간 모니터링</div>
        <div className="mt-2 text-[13px] text-white/90">현재 {ordered.length || 24}명의 게스트가 안전하게 해양레저를 즐기고 있습니다</div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[291px_minmax(0,1fr)]">
        <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
          <div className="mb-4 text-[15px] font-medium">활성 게스트</div>
          <div className="flex max-h-[240px] flex-col gap-[6px] overflow-auto pr-1">{ordered.slice(0, 6).map((sensor) => <GuestRow key={sensor.id} sensor={sensor} onClick={() => onSelect(sensor.id)} />)}</div>
        </div>
        <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-medium">라이브 맵</div>
            <div className="rounded-[18px] border border-[#e4e9f1] bg-white px-4 py-2 text-[10px]">위치</div>
          </div>
          <div className="h-[266px] overflow-hidden rounded-[9px]"><MapBox sensors={ordered} zoom={12} /></div>
        </div>
      </div>
      <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
        <div className="mb-4 text-[15px] font-medium">알림</div>
        <div className="flex gap-3 overflow-x-auto pb-1">{(alerts.length ? alerts : ordered.slice(0, 3)).map((sensor) => <AlertCard key={sensor.id} sensor={sensor} />)}</div>
      </div>
    </div>
  );
}

function LiveMap({ selected, ordered, region, onRegion, onSelect }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[576px_minmax(0,1fr)]">
      <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-medium">라이브 맵</div>
          <select className="rounded-[18px] border border-[#e4e9f1] bg-white px-4 py-2 text-[10px] outline-none" value={region} onChange={(event) => onRegion(event.target.value)}>
            <option>부산</option>
            <option>포항</option>
            <option>강원도</option>
            <option>제주도</option>
          </select>
        </div>
        <div className="h-[638px] overflow-hidden rounded-[9px]"><MapBox sensors={ordered} zoom={13} focus={selected} /></div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
          <div className="text-[15px] font-medium">선택된 게스트</div>
          <div className="mt-4 rounded-[9px] bg-[#f8fafc] px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar label={selected ? person(selected.id).name.slice(0, 1) : "-"} tone={selected?.id || 1} />
              <div className="text-[11px] leading-[12px]">
                <div className="font-medium">{selected ? person(selected.id).name : "-"}</div>
                <div className="mt-1 text-[#a1a1a1]">마지막 업데이트 : {selected ? when(selected.lastUpdate) : "-"}</div>
              </div>
              <div className="ml-auto text-[#a1a1a1]">···</div>
            </div>
          </div>
        </div>
        <button type="button" className="rounded-[18px] bg-[#e2e2e2] py-2 text-[10px] text-[#8c8c8c]">요원 긴급 배정</button>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="위험 스코어"><Gauge value={score(selected)} /></Panel>
          <Panel title="심박수"><Heart bpm={selected?.finger === 0 ? "---" : `${selected?.bpm || "---"}bpm`} /></Panel>
        </div>
        <Panel title="배터리"><BatteryWave level={battery(selected)} /></Panel>
        <div className="rounded-[12px] bg-white p-[13px] shadow-soft">
          <div className="mb-3 text-[13px] font-medium">전체 게스트 목록</div>
          <div className="grid gap-2 sm:grid-cols-2">{ordered.slice(0, 8).map((sensor) => <Compact key={sensor.id} sensor={sensor} onClick={() => onSelect(String(sensor.id))} />)}</div>
        </div>
      </div>
    </div>
  );
}

function Incidents({ incidents, filter, query, onFilter, onQuery }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-[28px] font-medium leading-none">사건 로그</div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={filter === "yesterday"} onClick={() => onFilter("yesterday")}>어제</Chip>
          <Chip active={filter === "today"} onClick={() => onFilter("today")}>오늘</Chip>
          <label className="flex h-[30px] items-center gap-2 rounded-[8px] border border-[#e4e9f1] bg-white px-3 text-[10px] text-[#8c8c8c]">
            <Search />
            <input className="w-[160px] border-0 bg-transparent p-0 text-[10px] outline-none" placeholder="검색..." value={query} onChange={(event) => onQuery(event.target.value)} />
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-2">{incidents.map((incident) => <IncidentCard key={incident.incident_id} incident={incident} />)}</div>
    </div>
  );
}

function Devices({ ordered }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[28px] font-medium leading-none">웨어러블 기기 목록</div>
          <div className="mt-2 text-[12px] text-[#a1a1a1]">등록된 디바이스의 상태와 정보를 관리합니다</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active>전체</Chip><Chip>대여중</Chip><Chip>사용가능</Chip><Chip>정비</Chip>
          <label className="flex h-[30px] items-center gap-2 rounded-[8px] border border-[#e4e9f1] bg-white px-3 text-[10px] text-[#8c8c8c]"><Search /><input className="w-[120px] border-0 bg-transparent p-0 text-[10px] outline-none" placeholder="검색..." /></label>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">{ordered.slice(0, 12).map((sensor) => <Device key={sensor.id} sensor={sensor} />)}</div>
      <div className="flex items-center justify-center gap-6 pt-2 text-[#113f67]"><span className="text-[20px]">‹</span><div className="flex gap-5"><span className="h-2.5 w-2.5 rounded-full bg-[#113f67]" /><span className="h-2.5 w-2.5 rounded-full border border-[#113f67]" /><span className="h-2.5 w-2.5 rounded-full border border-[#113f67]" /></div><span className="text-[20px]">›</span></div>
    </div>
  );
}

function Reports({ ordered, incidents }) {
  const danger = ordered.filter((sensor) => sensor.status === "danger").length;
  const warning = ordered.filter((sensor) => sensor.status === "warning").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[28px] font-medium leading-none">리포트</div>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="총 게스트"><div className="text-[42px] font-medium">{ordered.length}</div></Panel>
        <Panel title="주의 상태"><div className="text-[42px] font-medium text-[#113f67]">{warning}</div></Panel>
        <Panel title="오늘 사건"><div className="text-[42px] font-medium text-[#e31414]">{incidents.length}</div></Panel>
      </div>
      <Panel title="상태 분포">
        <div className="mt-6 flex h-[220px] items-end justify-between gap-4">
          {[["정상", Math.max(ordered.length - warning - danger, 1), "#14a1e3"], ["주의", Math.max(warning, 1), "#ffcf0f"], ["위험", Math.max(danger, 1), "#e31414"]].map(([label, value, color]) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-3"><div className="w-full rounded-t-[12px]" style={{ height: `${Math.max(24, Number(value) * 42)}px`, background: color }} /><div className="text-[11px] text-[#8c8c8c]">{label}</div></div>
          ))}
        </div>
      </Panel>
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
        const created = L.marker(pos, { icon: marker(sensor) }).addTo(map).bindPopup(`<strong>${person(sensor.id).name}</strong><br>${beach(sensor.id)}<br>${statusText(sensor.status)}`);
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
  const p = person(sensor.id);
  const [label, style] = priority(sensor);
  return (
    <button type="button" className="flex items-center gap-3 rounded-[9px] bg-[#f2f4f8] px-4 py-[5.5px] text-left" onClick={onClick}>
      <Avatar label={p.name.slice(0, 1)} tone={sensor.id} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-[18px]">{p.name} <span className="text-[11px] font-normal text-[#a1a1a1]">{p.age}세</span></div>
        <div className="mt-1 inline-flex items-center gap-2"><span className={`inline-flex min-w-[20px] justify-center px-[5px] py-px text-[8px] ${style}`}>{label}</span></div>
      </div>
      <div className="relative h-[24px] w-[24px] rotate-90"><div className="absolute inset-x-[8px] bottom-[4px] top-[7px] rounded-[1px] border border-[#054067]" /><div className="absolute left-[9px] right-[9px] top-[10px] h-[8px] rounded-[0.8px] bg-[#2dabb3]" style={{ opacity: Math.max(0.25, battery(sensor) / 100) }} /><div className="absolute left-[9px] right-[9px] top-[4px] h-[3px] rounded-t-[1px] bg-[#054067]" /></div>
    </button>
  );
}

function AlertCard({ sensor }) {
  const p = person(sensor.id);
  const [label, style] = priority(sensor);
  const headline = sensor.status === "danger" ? `심박수 ${sensor.bpm || 185}bpm, HRV 급락 감지` : sensor.finger === 0 ? "안전구역을 벗어남" : "지속적 고심박, 휴식 필요";
  return (
    <article className="min-w-[230px] rounded-[9px] bg-[#f2f4f8] px-6 py-4">
      <span className={`inline-flex min-w-[20px] justify-center px-[5px] py-px text-[8px] ${style}`}>{label}</span>
      <div className="mt-3 text-center text-[18px] font-medium">{p.name}</div>
      <div className="mt-1 text-center text-[11px] text-[#a1a1a1]">{beach(sensor.id)} / 위험스코어 {score(sensor)}</div>
      <div className="mt-4 text-center text-[13px] leading-[1.45]">{headline}</div>
      <div className="mt-5 flex items-center justify-center gap-5 text-[10px] text-[#8c8c8c]"><span>{when(sensor.lastUpdate)}</span><span>송정해수욕장</span></div>
    </article>
  );
}

function Compact({ sensor, onClick }) {
  return (
    <button type="button" className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 rounded-[4px] border border-[#dfe4eb] bg-[#fcfcfd] px-3 py-2 text-left" onClick={onClick}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: sensor.status === "danger" ? "#e31414" : sensor.status === "warning" ? "#ffcf0f" : sensor.status === "offline" ? "#9ca3af" : "#14a1e3" }} />
      <div><div className="text-[10px] font-medium">{person(sensor.id).name} {sensor.bpm || 0}bpm</div><div className="text-[7px] text-[#a1a1a1]">{when(sensor.lastUpdate)}</div></div>
      <div className="text-[10px] font-medium">{score(sensor)}점</div>
    </button>
  );
}

function IncidentCard({ incident }) {
  const p = person(incident.sensor_id || 1);
  const status = incident.status === "active" ? ["진행중", "bg-[#20b2aa] text-white"] : incident.status === "resolved" ? ["처리완료", "bg-[#113f67] text-white"] : ["오탐", "bg-[#ececec] text-[#666]"];
  const urgency = incident.status === "active" ? ["P1", "bg-[#e31414]"] : ["P2", "bg-[#ffcf0f]"];
  return (
    <article className="rounded-[14px] bg-[#f2f4f8] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><span className={`inline-flex h-[12px] min-w-[20px] items-center justify-center text-[8px] text-white ${urgency[1]}`}>{urgency[0]}</span><span className="text-[20px] font-medium tracking-[-0.05em]">{incident.incident_id}</span></div>
          <div className="mt-2 text-[14px] text-[#8c8c8c]">{p.name} / {incident.type || "과부하"}</div>
        </div>
        <span className={`rounded-[2px] px-3 py-1 text-[10px] font-medium ${status[1]}`}>{status[0]}</span>
      </div>
      <div className="mt-5 text-[16px] leading-[1.5]">{incident.description || "안전구역을 벗어남"}</div>
      <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] text-[#8c8c8c]"><span>{fmt(incident.created_at)}</span><span>{beach(incident.sensor_id || 1)}</span><span>{Math.max(2, Number(String(incident.incident_id).slice(-2)) || 8)}분</span><span>{p.name}</span></div>
    </article>
  );
}

function Device({ sensor }) {
  const p = person(sensor.id);
  const level = battery(sensor);
  const accent = sensor.status === "danger" ? "#ff3d3d" : sensor.status === "warning" ? "#ffcf0f" : "#29bf5b";
  return (
    <article className="rounded-[18px] bg-[#f2f4f8] px-4 py-3 shadow-soft">
      <div className="flex items-start justify-between gap-4"><div><div className="text-[12px] font-medium">Ocean Guard {sensor.id}</div><div className="mt-1 text-[11px] text-[#a1a1a1]">Aqua Tracker Pro</div></div><div className="flex items-end gap-1"><span className="h-3 w-1 rounded-full" style={{ background: accent, opacity: 0.5 }} /><span className="h-4 w-1 rounded-full" style={{ background: accent, opacity: 0.7 }} /><span className="h-5 w-1 rounded-full" style={{ background: accent }} /></div></div>
      <div className="mt-3 flex items-center justify-between text-[8px]"><span className="rounded-[2px] bg-[#1f5a82] px-2 py-1 text-white">{sensor.connected ? "대여중" : "정비"}</span><span className="text-[#8c8c8c]">{level}%</span></div>
      <div className="mt-3"><div className="mb-1 text-[7px] text-[#8c8c8c]">배터리</div><div className="h-[4px] rounded-full bg-white"><div className="h-[4px] rounded-full bg-[#1f5a82]" style={{ width: `${level}%` }} /></div></div>
      <div className="mt-2 flex justify-between text-[8px]"><span className="text-[#8c8c8c]">배터리</span><span className={sensor.status === "danger" ? "text-[#ff3d3d]" : sensor.status === "warning" ? "text-[#64748b]" : "text-[#1f5a82]"}>{statusText(sensor.status)}</span></div>
      <div className="mt-4 flex items-center gap-2 text-[10px] text-[#4b5563]"><span className="text-[#29bf5b]">◔</span><span>{sensor.connected ? p.name : "미할당"}</span></div>
    </article>
  );
}

function Panel({ title, children }) {
  return <div className="rounded-[12px] bg-white p-[13px] shadow-soft"><div className="text-[13px] font-medium">{title}</div><div className="mt-4">{children}</div></div>;
}

function Gauge({ value }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-[105px] w-[128px] overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0) 45%, rgba(255,255,255,1) 46%), conic-gradient(from 180deg at 50% 100%, #d8d8d8 0deg, #d8d8d8 180deg)" }}>
        <div className="absolute bottom-0 left-1/2 h-[128px] w-[128px] -translate-x-1/2 rounded-full border-[14px] border-b-transparent border-t-transparent" style={{ borderLeftColor: value > 33 ? "#d0d0d0" : "#ffcf0f", borderRightColor: value > 66 ? "#e31414" : "#d0d0d0", transform: `translateX(-50%) rotate(${Math.max(0, Math.min(180, (value / 100) * 180)) - 90}deg)` }} />
      </div>
      <div className="-mt-3 text-[18px] font-medium">{value || "--"}점</div>
    </div>
  );
}

function Heart({ bpm }) {
  return <div className="flex flex-col items-center justify-center gap-2 py-3"><div className="relative h-[88px] w-[90px]"><div className="absolute inset-0 flex items-center justify-center text-[72px] leading-none text-[#f3f5f9]">♥</div><div className="absolute inset-0 flex items-center justify-center text-[18px] font-medium text-[#666]">{bpm}</div></div></div>;
}

function BatteryWave({ level }) {
  return (
    <div className="overflow-hidden rounded-[9px] bg-[#f5f7fb] p-3">
      <svg viewBox="0 0 333 49" className="h-[49px] w-full">
        <path d="M0 28 C32 18 48 18 83 28 V49 H0 Z" fill="#e8edf5" />
        <path d="M84 18 C118 8 132 8 166 18 V49 H84 Z" fill="#e6ebf3" />
        <path d="M167 10 C198 0 218 0 249 10 V49 H167 Z" fill="#e4e9f1" />
        <path d="M250 0 C281 8 302 8 333 0 V49 H250 Z" fill="#dfe5ee" />
        <line x1={`${Math.max(30, (level / 100) * 333)}`} y1="0" x2={`${Math.max(30, (level / 100) * 333)}`} y2="49" stroke="#ffffff" strokeWidth="1.5" opacity="0.85" />
      </svg>
    </div>
  );
}

function Chip({ active = false, children, onClick = () => {} }) {
  return <button type="button" className={`rounded-[8px] border px-4 py-1.5 text-[10px] ${active ? "border-[#113f67] bg-[#113f67] text-white" : "border-[#dfe4eb] bg-white text-[#666]"}`} onClick={onClick}>{children}</button>;
}

function Avatar({ label, tone, className = "" }) {
  const tones = ["from-[#1f5a82] to-[#2aa9b5]", "from-[#f39c6b] to-[#d87553]", "from-[#4f81c7] to-[#224f8a]", "from-[#b1b6bf] to-[#eceff4]"];
  return <div className={`flex h-[37.5px] w-[37.5px] items-center justify-center rounded-full bg-gradient-to-br text-[14px] font-medium text-white ${tones[(Number(tone) - 1 + tones.length) % tones.length]} ${className}`}>{label}</div>;
}

function Logo({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M29 4L47 10V28C47 40.2 38.2 50.4 26.2 53.1L23.8 53.6L23.6 50.3C23 39.3 14.9 30.4 4 28.6V10L29 4Z" fill="#11658A" />
      <path d="M45.3 15C41.8 14.7 37.9 15.8 34.2 18.2C28.4 22 22.2 21.5 16.2 16.7L14 15L12.5 17.5C11.8 18.7 11.2 20 10.8 21.4C16.4 25.4 22.7 26.4 28.6 24.4C33.2 22.8 36.4 19.5 39.9 18.5C41.8 17.9 43.7 17.9 45.7 18.6L45.3 15Z" fill="#66D8E8" />
      <path d="M16.3 27.9C19.8 31.4 24 33.6 28.5 34.2C35.6 35.2 42.8 32.4 47 27.2V22.5C43.8 28.2 37.6 31.7 31 31.4C25.3 31.2 20.1 28.3 16.3 23.4V27.9Z" fill="#E8FAFF" />
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
