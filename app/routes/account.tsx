import { useEffect, useState } from "react";

export function meta() {
	return [
		{ title: "Account | NetQueue" },
		{ name: "description", content: "Create or access your NetQueue account." },
	];
}

type User = { displayName: string; email: string };

export default function Account() {
	const [mode, setMode] = useState<"login" | "register">("register");
	const [user, setUser] = useState<User | null>(null);
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");

	useEffect(() => {
		fetch("/api/auth/me", { credentials: "same-origin" })
			.then((response) => response.json() as Promise<{ user: User | null }>)
			.then((result) => setUser(result.user));
	}, []);

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage("");
		const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ email, displayName, password }),
		});
		const result = await response.json() as { user?: User; error?: string };
		if (!response.ok || !result.user) {
			setMessage(result.error ?? "Unable to complete that request.");
			return;
		}
		setUser(result.user);
		setPassword("");
		setMessage("You are signed in. Your schedule is ready.");
	};

	const signOut = async () => {
		await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
		setUser(null);
		setMessage("You have been signed out.");
	};

	return <main className="page-shell"><header className="page-topbar"><a className="brand" href="/" aria-label="NetQueue home"><span className="brand-mark">NQ</span><span>NetQueue</span></a><nav className="page-nav" aria-label="Primary navigation"><a href="/">Availability</a><a href="/schedule">Schedule</a><a className="nav-active" href="/account">Account</a></nav></header><section className="account-hero"><p className="eyebrow">Your NetQueue</p><h1>Keep your next<br /><em>visit in view.</em></h1><p className="page-lede">Create an account to reserve a time, then arrive knowing your plan is already set.</p></section><section className="account-section account-page-section"><div className="account-heading"><div><p className="eyebrow">{user ? "Account active" : "Secure access"}</p><h2>{user ? `Welcome, ${user.displayName}` : "Create your account"}</h2></div>{user && <button className="text-button" type="button" onClick={signOut}>Sign out</button>}</div>{user ? <div className="account-grid"><div className="account-note"><span className="note-number">READY</span><p>Your account is active. Keep your email private and use the Schedule page to plan your next visit.</p><a className="primary-button" href="/schedule">Open schedule</a></div></div> : <div className="account-grid"><form className="account-form" onSubmit={submit}><div className="mode-switch"><button className={mode === "register" ? "mode-active" : ""} type="button" onClick={() => setMode("register")}>Create account</button><button className={mode === "login" ? "mode-active" : ""} type="button" onClick={() => setMode("login")}>Sign in</button></div>{mode === "register" && <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} autoComplete="name" /></label>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required autoComplete={mode === "register" ? "new-password" : "current-password"} /></label><button className="primary-button" type="submit">{mode === "register" ? "Create account" : "Sign in"}</button>{message && <p className="form-message" role="status">{message}</p>}</form><div className="account-note"><span className="note-number">01</span><p>Passwords are hashed before storage and are never visible to NetQueue staff or the desktop dashboard.</p></div></div>}</section></main>;
}
