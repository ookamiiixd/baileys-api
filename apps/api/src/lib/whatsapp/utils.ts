import { sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Effect, Schema as S } from "effect";
import * as Database from "~/lib/db/index.js";
import type { Contact } from "../db/schema/contacts.js";

export const LidJid = S.String.pipe(S.pattern(/^\d+@lid$/), S.brand("LidJid"));
export type LidJid = typeof LidJid.Type;

export const PhoneNumberJid = S.String.pipe(
	S.pattern(/^\d+@s\.whatsapp\.net$/),
	S.brand("PhoneNumberJid"),
);
export type PhoneNumberJid = typeof PhoneNumberJid.Type;

export const GroupJid = S.String.pipe(S.pattern(/^[\d-]+@g\.us$/), S.brand("GroupJid"));
export type GroupJid = typeof GroupJid.Type;

export type AnyJid = LidJid | PhoneNumberJid;

export const isLidJid = S.is(LidJid);
export const isPhoneNumberJid = S.is(PhoneNumberJid);
export const isGroupJid = S.is(GroupJid);

/**
 * Fetch alternate `jid` for a given `jid` from the database.
 * If a single `jid` is provided, returns the alternate `jid` or `null` if alternate `jid` doesn't exist.
 * If an array of `jid`s is provided, returns a map of all found `jid`s and their alternates.
 */
export const getAlternateJidFromDatabase = Effect.fn("WhatsAppUtils.getAlternateJidFromDatabase")(
	function* (jid, maybeClient) {
		const client = maybeClient ?? (yield* Database.Database);
		const map = new Map<string, AnyJid>();
		const jids = Array.isArray(jid) ? jid : [jid];
		const payload = jids.map((jid) => {
			let id: string = jid;
			const kind: Contact["idType"] = isPhoneNumberJid(id) ? "phone-number" : "lid";
			if (!id.includes("@")) {
				id = `${id}@lid`;
			}

			return { id, idType: kind };
		});

		if (Array.isArray(jid) && payload.length <= 0) {
			return map;
		}

		const foundContacts = yield* client.query.contacts.findMany({
			where: {
				OR: payload.map((p) => ({
					RAW: (t) =>
						sql`(
	${t.data}->>'${sql.raw(p.idType === "lid" ? "lid" : "phoneNumber")}' = ${p.id} and
	coalesce(${t.data}->>'${sql.raw(p.idType === "lid" ? "phoneNumber" : "lid")}', '') <> ''
)`,
				})),
			},
		});

		if (!Array.isArray(jid)) {
			const contact = foundContacts[0];
			if (!contact) {
				return null;
			}

			const isPhoneNumber = isPhoneNumberJid(jid);
			if (isPhoneNumber && contact.data.lid) {
				return contact.data.lid;
			} else if (!isPhoneNumber && contact.data.phoneNumber) {
				return contact.data.phoneNumber;
			}
			return null;
		}

		for (const contact of foundContacts) {
			if (!contact.data.lid || !contact.data.phoneNumber) {
				continue;
			}

			map.set(contact.data.lid, contact.data.phoneNumber as AnyJid);
			map.set(contact.data.phoneNumber, contact.data.lid as AnyJid);
		}

		return map;
	},
) as <Jid extends string | string[]>(
	jid: Jid,
	maybeClient?: Database.TransactionClient | Database.DatabaseClient,
) => Effect.Effect<
	Jid extends string[] ? Map<string, AnyJid> : AnyJid | null,
	EffectDrizzleQueryError,
	Database.Database
>;
