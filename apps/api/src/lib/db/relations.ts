import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.js";

export const relations = defineRelations(schema, (r) => ({
	connections: {
		authStates: r.many.authStates(),
		contacts: r.many.contacts(),
		chats: r.many.chats(),
		messages: r.many.messages(),
		groups: r.many.groups(),
	},
	authStates: {
		connection: r.one.connections({
			from: r.authStates.connectionId,
			to: r.connections.recordId,
		}),
	},
	contacts: {
		connection: r.one.connections({
			from: r.contacts.connectionId,
			to: r.connections.recordId,
		}),
	},
	chats: {
		connection: r.one.connections({
			from: r.chats.connectionId,
			to: r.connections.recordId,
		}),
	},
	messages: {
		connection: r.one.connections({
			from: r.messages.connectionId,
			to: r.connections.recordId,
		}),
	},
	groups: {
		connection: r.one.connections({
			from: r.groups.connectionId,
			to: r.connections.recordId,
		}),
	},
}));
