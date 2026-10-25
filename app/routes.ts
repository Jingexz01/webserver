import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("account", "routes/account.tsx"),
	route("schedule", "routes/schedule.tsx"),
] satisfies RouteConfig;
