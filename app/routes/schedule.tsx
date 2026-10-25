import { useEffect, useState } from "react";

export function meta() {
	return [
		{ title: "Schedule | NetQueue" },
		{ name: "description", content: "Plan your next NetQueue visit." },
	];
}

type User = { displayName: string; email: string };
type Booking = { id: string; zone: "VIP" | "Standard"; startAt: string; endAt: string; status: string };

export default function Schedule() {
	const [user, setUser] = useState<User | null>(null);
	const [bookings, setBookings] = useState<Booking[]>([]);
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

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");
		const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ zone, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }) });
		const result = await response.json() as { error?: string };
		if (!response.ok) {
			setMessage(result.error ?? "Unable to schedule that visit.");
			return;
		}
		setMessage("Visit scheduled.");
		setStartAt("");
		setEndAt("");
		void loadBookings();
	};

	return <main className="page-shell"><header className="page-topbar"><a className="brand" href="/" aria-label="NetQueue home"><span className="brand-mark">NQ</span><span>NetQueue</span></a><nav className="page-nav" aria-label="Primary navigation"><a href="/">Availability</a><a className="nav-active" href="/schedule">Schedule</a><a href="/account">Account</a></nav></header><section className="account-hero"><p className="eyebrow">Plan ahead</p><h1>Make time for<br /><em>your session.</em></h1><p className="page-lede">Reserve a future visit for your preferred zone. Your booking will appear in the NetQueue desktop dashboard.</p></section>{!user ? <section className="schedule-locked"><span className="state-mark">NQ</span><h2>Sign in to schedule</h2><p>Create an account first so your bookings stay attached to you.</p><a className="primary-button" href="/account">Open account</a></section> : <section className="account-section account-page-section"><div className="account-heading"><div><p className="eyebrow">Signed in as {user.displayName}</p><h2>Upcoming visits</h2></div></div><div className="schedule-grid"><form className="account-form" onSubmit={submit}><label>Zone<select value={zone} onChange={(event) => setZone(event.target.value as "Standard" | "VIP")}><option>Standard</option><option>VIP</option></select></label><label>Arrive<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /></label><label>Leave<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required /></label><button className="primary-button" type="submit">Schedule visit</button>{message && <p className="form-message" role="status">{message}</p>}</form><div className="booking-list"><p className="eyebrow">Your schedule</p>{bookings.length === 0 ? <p className="empty-state">No visits scheduled yet.</p> : bookings.map((booking) => <div className="booking-row" key={booking.id}><strong>{booking.zone}</strong><span>{new Date(booking.startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span><span>{new Date(booking.endAt).toLocaleTimeString([], { timeStyle: "short" })}</span></div>)}</div></div></section>}<footer className="site-footer"><span>NetQueue</span><a href="/">Back to availability</a></footer></main>;
}
