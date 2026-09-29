import { createRequestHandler } from "react-router";

export { NetQueueState } from "./netqueue-state";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

function stateObject(env: Env) {
	return env.NETQUEUE_STATE.get(env.NETQUEUE_STATE.idFromName("main"));
}

async function readSnapshot(env: Env) {
	return stateObject(env).fetch("https://netqueue-state/snapshot");
}

async function updateSnapshot(request: Request, env: Env) {
	const authorization = request.headers.get("Authorization");
	if (authorization !== `Bearer ${env.NETQUEUE_PUSH_TOKEN}`) {
		return new Response("Unauthorized", { status: 401 });
	}
	const contentLength = Number(request.headers.get("Content-Length"));
	if (Number.isFinite(contentLength) && contentLength > 100_000) {
		return new Response("Request body is too large", { status: 413 });
	}

	let snapshot: unknown;
	try {
		snapshot = await request.json();
	} catch {
		return new Response("Request body must be valid JSON", { status: 400 });
	}
	if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
		return new Response("Request body must be a JSON object", { status: 400 });
	}
	const candidate = snapshot as { stations?: unknown; queueLength?: unknown };
	if (!Array.isArray(candidate.stations) || candidate.stations.length > 100 ||
		!Number.isInteger(candidate.queueLength) || Number(candidate.queueLength) < 0 ||
		!candidate.stations.every(isStationRecord)) {
		return new Response("Invalid station snapshot", { status: 400 });
	}

	return stateObject(env).fetch("https://netqueue-state/snapshot", {
		method: "PUT",
		body: JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }),
	});
}

const SESSION_COOKIE = "nq_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function json(data: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(data), {
		...init,
		headers: { "Content-Type": "application/json; charset=utf-8", ...init.headers },
	});
}

function base64Url(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromBase64Url(value: string) {
	const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function passwordHash(password: string, salt: Uint8Array) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" }, key, 256);
	return base64Url(new Uint8Array(bits));
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
	return difference === 0;
}

async function sessionCookie(userId: string, secret: string) {
	const payload = `${userId}.${Date.now() + SESSION_TTL_SECONDS * 1000}`;
	const signature = await hmac(payload, secret);
	return `${SESSION_COOKIE}=${payload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

async function userIdFromRequest(request: Request, secret: string) {
	const cookie = request.headers.get("Cookie")?.split(";").map((part) => part.trim())
		.find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
	if (!cookie) return null;
	const parts = cookie.split(".");
	if (parts.length !== 3 || !/^\d+$/.test(parts[1])) return null;
	if (Number(parts[1]) < Date.now()) return null;
	const expected = await hmac(`${parts[0]}.${parts[1]}`, secret);
	return sameBytes(new TextEncoder().encode(parts[2]), new TextEncoder().encode(expected)) ? parts[0] : null;
}

async function readJson(request: Request) {
	const contentLength = Number(request.headers.get("Content-Length"));
	if (Number.isFinite(contentLength) && contentLength > 16_384) throw new Error("Request body is too large");
	return request.json() as Promise<Record<string, unknown>>;
}

async function register(request: Request, env: Env) {
	let body: Record<string, unknown>;
	try { body = await readJson(request); } catch { return json({ error: "Invalid registration request" }, { status: 400 }); }
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
	const password = typeof body.password === "string" ? body.password : "";
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || displayName.length > 80 || password.length < 8 || password.length > 128) {
		return json({ error: "Use a valid email, name, and password of 8-128 characters" }, { status: 400 });
	}
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const userId = crypto.randomUUID();
	try {
		await env.NETQUEUE_DB.prepare("INSERT INTO users (id, email, display_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(userId, email, displayName, await passwordHash(password, salt), base64Url(salt), new Date().toISOString()).run();
	} catch {
		return json({ error: "An account with that email already exists" }, { status: 409 });
	}
	return json({ user: { id: userId, email, displayName } }, { headers: { "Set-Cookie": await sessionCookie(userId, env.NETQUEUE_SESSION_SECRET) } });
}

async function login(request: Request, env: Env) {
	let body: Record<string, unknown>;
	try { body = await readJson(request); } catch { return json({ error: "Invalid login request" }, { status: 400 }); }
	const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
	const password = typeof body.password === "string" ? body.password : "";
	const user = await env.NETQUEUE_DB.prepare("SELECT id, email, display_name, password_hash, password_salt FROM users WHERE email = ?")
		.bind(email).first<{ id: string; email: string; display_name: string; password_hash: string; password_salt: string }>();
	if (!user || !sameBytes(new TextEncoder().encode(user.password_hash), new TextEncoder().encode(await passwordHash(password, bytesFromBase64Url(user.password_salt))))) {
		return json({ error: "Invalid email or password" }, { status: 401 });
	}
	return json({ user: { id: user.id, email: user.email, displayName: user.display_name } }, { headers: { "Set-Cookie": await sessionCookie(user.id, env.NETQUEUE_SESSION_SECRET) } });
}

async function currentUser(request: Request, env: Env) {
	const userId = await userIdFromRequest(request, env.NETQUEUE_SESSION_SECRET);
	if (!userId) return json({ user: null });
	const user = await env.NETQUEUE_DB.prepare("SELECT id, email, display_name FROM users WHERE id = ?").bind(userId).first<{ id: string; email: string; display_name: string }>();
	return json({ user: user ? { id: user.id, email: user.email, displayName: user.display_name } : null });
}

async function bookings(request: Request, env: Env) {
	const userId = await userIdFromRequest(request, env.NETQUEUE_SESSION_SECRET);
	if (!userId) return json({ error: "Authentication required" }, { status: 401 });
	if (request.method === "GET") {
		const result = await env.NETQUEUE_DB.prepare("SELECT id, zone, start_at AS startAt, end_at AS endAt, status FROM bookings WHERE user_id = ? ORDER BY start_at")
			.bind(userId).all();
		return json({ bookings: result.results });
	}
	let body: Record<string, unknown>;
	try { body = await readJson(request); } catch { return json({ error: "Invalid booking request" }, { status: 400 }); }
	const zone = body.zone === "VIP" ? "VIP" : body.zone === "Standard" ? "Standard" : "";
	const startAt = typeof body.startAt === "string" ? Date.parse(body.startAt) : NaN;
	const endAt = typeof body.endAt === "string" ? Date.parse(body.endAt) : NaN;
	if (!zone || !Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt < Date.now() || endAt <= startAt || endAt - startAt > 4 * 60 * 60 * 1000) {
		return json({ error: "Choose a future booking within four hours" }, { status: 400 });
	}
	const bookingId = crypto.randomUUID();
	await env.NETQUEUE_DB.prepare("INSERT INTO bookings (id, user_id, zone, start_at, end_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(bookingId, userId, zone, new Date(startAt).toISOString(), new Date(endAt).toISOString(), new Date().toISOString()).run();
	return json({ booking: { id: bookingId, zone, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), status: "scheduled" } }, { status: 201 });
}

async function javaBookings(request: Request, env: Env) {
	if (request.headers.get("Authorization") !== `Bearer ${env.NETQUEUE_PUSH_TOKEN}`) return json({ error: "Unauthorized" }, { status: 401 });
	const result = await env.NETQUEUE_DB.prepare("SELECT bookings.id, users.display_name AS displayName, users.email, bookings.zone, bookings.start_at AS startAt, bookings.end_at AS endAt, bookings.status FROM bookings JOIN users ON users.id = bookings.user_id WHERE bookings.status = 'scheduled' ORDER BY bookings.start_at").all();
	return json({ bookings: result.results });
}

function isStationRecord(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const station = value as Record<string, unknown>;
	return typeof station.id === "string" && station.id.length <= 32 &&
		typeof station.zone === "string" && (station.zone === "VIP" || station.zone === "Standard") &&
		typeof station.status === "string" && ["Available", "In Use", "Offline"].includes(station.status) &&
		typeof station.detail === "string" && station.detail.length <= 160;
}

export default {
	fetch(request, env, ctx) {
		const pathname = new URL(request.url).pathname;
		if (pathname === "/api/stations" && request.method === "GET") return readSnapshot(env);
		if (pathname === "/api/stations/update" && request.method === "POST") return updateSnapshot(request, env);
		if (pathname === "/api/auth/register" && request.method === "POST") return register(request, env);
		if (pathname === "/api/auth/login" && request.method === "POST") return login(request, env);
		if (pathname === "/api/auth/me" && request.method === "GET") return currentUser(request, env);
		if (pathname === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, { headers: { "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` } });
		if (pathname === "/api/bookings" && (request.method === "GET" || request.method === "POST")) return bookings(request, env);
		if (pathname === "/api/bookings/java" && request.method === "GET") return javaBookings(request, env);
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<Env>;
