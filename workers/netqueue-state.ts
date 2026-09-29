export class NetQueueState {
	private readonly state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method === "GET") {
			const snapshot = await this.state.storage.get<string>("snapshot");
			return new Response(snapshot ?? JSON.stringify({ stations: [], queueLength: 0, updatedAt: null }), {
				headers: { "Content-Type": "application/json; charset=utf-8" },
			});
		}

		if (request.method === "PUT") {
			const snapshot = await request.text();
			JSON.parse(snapshot);
			await this.state.storage.put("snapshot", snapshot);
			return new Response(null, { status: 204 });
		}

		return new Response("Method not allowed", { status: 405 });
	}
}