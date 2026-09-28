import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "NetQueue | Check PC availability" },
		{ name: "description", content: "See which NetQueue PCs are free before you arrive." },
	];
}

export function loader({ context }: Route.LoaderArgs) {
	return { locationName: context.cloudflare.env.VALUE_FROM_CLOUDFLARE };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return <Welcome locationName={loaderData.locationName} />;
}
