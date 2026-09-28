import { createRequestHandler } from "react-router";

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

async function proxyNetQueue(env: Env) {
	const upstream = new URL("/api/stations", env.NETQUEUE_API_URL);
	const response = await fetch(upstream);
	return new Response(response.body, {
		status: response.status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

export default {
	fetch(request, env, ctx) {
		if (new URL(request.url).pathname === "/api/stations") return proxyNetQueue(env);
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
} satisfies ExportedHandler<Env>;
