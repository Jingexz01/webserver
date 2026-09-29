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

type User = { id: string; email: string; displayName: string };
type Booking = { id: string; zone: "VIP" | "Standard"; startAt: string; endAt: string; status: string };

export function Welcome({ locationName }: { locationName: string }) {
	const [data, setData] = useState<StationResponse | null>(null);
	const [error, setError] = useState(false);
	const [retryKey, setRetryKey] = useState(0);

	useEffect(() => {
		let active = true;
		const load = async () => {
			try {
				const response = await fetch("/api/stations", { cache: "no-store" });
				if (!response.ok) throw new Error("NetQueue unavailable");
				const next = (await response.json()) as StationResponse;
				const updatedAt = Date.parse(next.updatedAt);
				if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > 45_000) throw new Error("NetQueue heartbeat expired");
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
	}, [retryKey]);

	const stations = data?.stations ?? [];
	const available = useMemo(() => stations.filter((station) => station.status === "Available"), [stations]);
	const vipAvailable = available.filter((station) => station.zone === "VIP").length;
	const standardAvailable = available.filter((station) => station.zone === "Standard").length;
	const lastUpdated = data ? new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "waiting for NetQueue";

	if (error) return <OfflineState locationName={locationName} onRetry={() => { setError(false); setRetryKey((value) => value + 1); }} />;
	if (!data) return <LoadingState locationName={locationName} />;

	return (
		<main className="site-shell">
			<header className="topbar">
				<a className="brand" href="/" aria-label="NetQueue home"><span className="brand-mark">NQ</span><span>NetQueue</span></a>
				<span className="connection" aria-live="polite"><span className="connection-dot" />Live availability</span>
			</header>
			<section className="hero">
				<div className="hero-copy">
					<p className="eyebrow">{locationName}</p>
					<h1>Know your station<br /><em>before you go.</em></h1>
					<p className="lede">Check live PC availability from home, then walk in ready. NetQueue updates this board whenever a station changes.</p>
				</div>
				<div className="hero-status">
					<span className="status-ring" />
					<div><strong aria-live="polite">{data ? available.length : "-"}</strong><span>stations free right now</span></div>
				</div>
			</section>
			<section className="availability" aria-labelledby="availability-title">
				<div className="section-heading"><div><p className="eyebrow">Live board</p><h2 id="availability-title">Choose your zone</h2></div><span className="updated" aria-live="polite">Updated {lastUpdated}</span></div>
				<div className="zone-grid">
					<ZoneCard title="Standard" subtitle="Everyday work & play" count={standardAvailable} stations={stations.filter((station) => station.zone === "Standard")} />
					<ZoneCard title="VIP" subtitle="Extra power, quieter setup" count={vipAvailable} stations={stations.filter((station) => station.zone === "VIP")} accent />
				</div>
			</section>
			<AccountPanel />
			<footer className="site-footer"><span>Arrive, check in, get online.</span><span>{data ? `${data.queueLength} ${data.queueLength === 1 ? "person" : "people"} waiting` : "Connecting to NetQueue..."}</span></footer>
		</main>
	);
}

function LoadingState({ locationName }: { locationName: string }) {
	return <main className="state-shell"><div className="state-panel"><span className="state-mark">NQ</span><p className="eyebrow">{locationName}</p><h1>Checking the<br /><em>station floor.</em></h1><span className="loading-line" aria-label="Loading" /></div></main>;
}

function OfflineState({ locationName, onRetry }: { locationName: string; onRetry: () => void }) {
	return <main className="state-shell state-shell-offline"><div className="state-panel"><span className="state-mark">NQ</span><p className="eyebrow">{locationName}</p><h1>The server<br /><em>is offline.</em></h1><p className="state-copy">NetQueue is not receiving a live update from the server right now. Check back in a moment or try again later.</p><button className="retry-button" type="button" onClick={onRetry}><span>↻</span> Try again</button><p className="state-note">Live availability will return automatically when the connection is restored.</p></div></main>;
}

function ZoneCard({ title, subtitle, count, stations, accent = false }: { title: string; subtitle: string; count: number; stations: Station[]; accent?: boolean }) {
	return <article className={`zone-card ${accent ? "zone-card-accent" : ""}`}>
		<div className="zone-header"><div><span className="zone-index">0{accent ? 2 : 1}</span><h3>{title}</h3><p>{subtitle}</p></div><strong className={count > 0 ? "count-available" : "count-empty"}>{count}<small> free</small></strong></div>
		<div className="station-list">{stations.length === 0 ? <p className="empty-state">Waiting for station data</p> : stations.map((station) => <div className="station-row" key={station.id}><span className={`station-light station-${station.status.toLowerCase().replace(" ", "-")}`} /><span className="station-id">{station.id}</span><span className="station-detail">{station.status === "Available" ? "Ready for you" : station.status === "In Use" ? "In use" : station.detail}</span><span className={`station-status station-status-${station.status.toLowerCase().replace(" ", "-")}`}>{station.status}</span></div>)}</div>
	</article>;
}

function AccountPanel() {
	const [user, setUser] = useState<User | null>(null);
	const [bookings, setBookings] = useState<Booking[]>([]);
	const [mode, setMode] = useState<"login" | "register">("register");
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [zone, setZone] = useState<"Standard" | "VIP">("Standard");
	const [startAt, setStartAt] = useState("");
	const [endAt, setEndAt] = useState("");
	const [message, setMessage] = useState("");

	const loadBookings = async () => {
		const response = await fetch("/api/bookings", { credentials: "same-origin" });
		if (response.ok) setBookings(((await response.json()) as { bookings: Booking[] }).bookings);
	};

	useEffect(() => {
		fetch("/api/auth/me", { credentials: "same-origin" })
			.then((response) => response.json() as Promise<{ user: User | null }>)
			.then((result) => {
				setUser(result.user);
				if (result.user) void loadBookings();
			});
	}, []);

	const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");
		const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
		const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ email, password, displayName }) });
		const result = await response.json() as { user?: User; error?: string };
		if (!response.ok || !result.user) return setMessage(result.error ?? "Unable to sign in");
		setUser(result.user);
		setPassword("");
		setMessage("Account ready. Choose a time below.");
		void loadBookings();
	};

	const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ zone, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }) });
		const result = await response.json() as { error?: string };
		if (!response.ok) return setMessage(result.error ?? "Unable to schedule the visit");
		setMessage("Visit scheduled.");
		void loadBookings();
	};

	const logout = async () => {
		await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
		setUser(null);
		setBookings([]);
		setMessage("");
	};

	return <section className="account-section" aria-labelledby="account-title"><div className="account-heading"><div><p className="eyebrow">Plan your visit</p><h2 id="account-title">Reserve your time</h2></div>{user && <button className="text-button" type="button" onClick={logout}>Sign out</button>}</div>{!user ? <div className="account-grid"><form className="account-form" onSubmit={submitAuth}><div className="mode-switch"><button className={mode === "register" ? "mode-active" : ""} type="button" onClick={() => setMode("register")}>Create account</button><button className={mode === "login" ? "mode-active" : ""} type="button" onClick={() => setMode("login")}>Sign in</button></div>{mode === "register" && <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} /></label>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label><button className="primary-button" type="submit">{mode === "register" ? "Create account" : "Sign in"}</button>{message && <p className="form-message">{message}</p>}</form><div className="account-note"><span className="note-number">01</span><p>Create an account to schedule your arrival. Your password is stored securely and never shown in the station dashboard.</p></div></div> : <div className="schedule-grid"><form className="account-form" onSubmit={submitBooking}><p className="signed-in">Signed in as <strong>{user.displayName}</strong></p><label>Zone<select value={zone} onChange={(event) => setZone(event.target.value as "Standard" | "VIP")}><option>Standard</option><option>VIP</option></select></label><label>Arrive<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label><label>Leave<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required /></label><button className="primary-button" type="submit">Schedule visit</button>{message && <p className="form-message">{message}</p>}</form><div className="booking-list"><p className="eyebrow">Your schedule</p>{bookings.length === 0 ? <p className="empty-state">No visits scheduled yet.</p> : bookings.map((booking) => <div className="booking-row" key={booking.id}><strong>{booking.zone}</strong><span>{new Date(booking.startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span><span>{new Date(booking.endAt).toLocaleTimeString([], { timeStyle: "short" })}</span></div>)}</div></div>}</section>;
}
