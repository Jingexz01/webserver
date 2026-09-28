import { useEffect, useMemo, useState } from "react";

type Station = {
	id: string;
	zone: "VIP" | "Standard";
	status: "Available" | "In Use" | "Offline";
	detail: string;
};

type StationResponse = {
	stations: Station[];
	queueLength: number;
	updatedAt: string;
};

export function Welcome({ locationName }: { locationName: string }) {
	const [data, setData] = useState<StationResponse | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let active = true;
		const load = async () => {
			try {
				const response = await fetch("/api/stations", { cache: "no-store" });
				if (!response.ok) throw new Error("NetQueue unavailable");
				const next = (await response.json()) as StationResponse;
				if (active) {
					setData(next);
					setError(false);
				}
			} catch {
				if (active) setError(true);
			}
		};
		load();
		const interval = window.setInterval(load, 15_000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, []);

	const stations = data?.stations ?? [];
	const available = useMemo(() => stations.filter((station) => station.status === "Available"), [stations]);
	const vipAvailable = available.filter((station) => station.zone === "VIP").length;
	const standardAvailable = available.filter((station) => station.zone === "Standard").length;
	const lastUpdated = data ? new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "waiting for NetQueue";

	return (
		<main className="site-shell">
			<header className="topbar">
				<a className="brand" href="/" aria-label="NetQueue home"><span className="brand-mark">NQ</span><span>NetQueue</span></a>
				<span className={`connection ${error ? "connection-offline" : ""}`}><span className="connection-dot" />{error ? "Desktop app offline" : "Live availability"}</span>
			</header>
			<section className="hero">
				<div className="hero-copy">
					<p className="eyebrow">{locationName} / PC lounge</p>
					<h1>Know your station<br /><em>before you go.</em></h1>
					<p className="lede">Check live PC availability from home, then walk in ready. NetQueue updates this board whenever a station changes.</p>
				</div>
				<div className="hero-status">
					<span className="status-ring" />
					<div><strong>{data ? available.length : "-"}</strong><span>stations free right now</span></div>
				</div>
			</section>
			<section className="availability" aria-labelledby="availability-title">
				<div className="section-heading"><div><p className="eyebrow">Live board</p><h2 id="availability-title">Choose your zone</h2></div><span className="updated">Updated {lastUpdated}</span></div>
				<div className="zone-grid">
					<ZoneCard title="Standard" subtitle="Everyday work & play" count={standardAvailable} stations={stations.filter((station) => station.zone === "Standard")} />
					<ZoneCard title="VIP" subtitle="Extra power, quieter setup" count={vipAvailable} stations={stations.filter((station) => station.zone === "VIP")} accent />
				</div>
			</section>
			<footer className="site-footer"><span>Arrive, check in, get online.</span><span>{data ? `${data.queueLength} ${data.queueLength === 1 ? "person" : "people"} waiting` : "Connecting to NetQueue..."}</span></footer>
		</main>
	);
}

function ZoneCard({ title, subtitle, count, stations, accent = false }: { title: string; subtitle: string; count: number; stations: Station[]; accent?: boolean }) {
	return <article className={`zone-card ${accent ? "zone-card-accent" : ""}`}>
		<div className="zone-header"><div><h3>{title}</h3><p>{subtitle}</p></div><strong className={count > 0 ? "count-available" : "count-empty"}>{count}<small> free</small></strong></div>
		<div className="station-list">{stations.length === 0 ? <p className="empty-state">Waiting for station data</p> : stations.map((station) => <div className="station-row" key={station.id}><span className={`station-light station-${station.status.toLowerCase().replace(" ", "-")}`} /><span className="station-id">{station.id}</span><span className="station-detail">{station.status === "Available" ? "Ready for you" : station.status === "In Use" ? "In use" : station.detail}</span><span className={`station-status station-status-${station.status.toLowerCase().replace(" ", "-")}`}>{station.status}</span></div>)}</div>
	</article>;
}
