import { DateTime, Schema as S } from "effect";
import { type RecordFromDatabase, Timestamps } from "../../schema.js";
import { ConnectionId } from "../connections/schema.js";

export const ContactId = S.Number.pipe(S.int(), S.positive(), S.brand("ContactId")).annotations({
	description: "A unique identifier for the contact.",
});
export type ContactId = typeof ContactId.Type;

export const ContactIdFromString = S.transform(
	S.NumberFromString.pipe(S.int(), S.positive()),
	ContactId,
	{
		strict: true,
		decode: (value) => ContactId.make(value),
		encode: (value) => value,
	},
);
export type ContactIdFromString = typeof ContactIdFromString.Type;

export class ContactData extends S.Class<ContactData>("ContactData")(
	{
		id: S.String,
		lid: S.String.pipe(S.optional),
		phoneNumber: S.String.pipe(S.optional),
		name: S.String.pipe(S.optional),
		notify: S.String.pipe(S.optional),
		verifiedName: S.String.pipe(S.optional),
		imgUrl: S.String.pipe(S.NullOr, S.optional),
		status: S.String.pipe(S.optional),
	},
	{ identifier: "ContactData" },
) {}

type EncodedContact = (typeof Contact)["Encoded"];
interface ContactFromDatabase
	extends RecordFromDatabase,
		Omit<EncodedContact, keyof RecordFromDatabase> {}

export class Contact extends S.Class<Contact>("Contact")(
	{
		recordId: ContactId,
		connectionId: ConnectionId,

		id: S.String.annotations({
			description: "The contact's jid. Could be a lid jid or phone number jid.",
		}),
		idType: S.Literal("lid", "phone-number").annotations({
			description: "The type of the contact's id.",
		}),
		data: ContactData.annotations({
			description: "The contact's data.",
		}),

		...Timestamps.fields,
	},
	{ identifier: "Contact" },
) {
	update(input: Partial<Pick<Contact, "id" | "idType" | "data">>) {
		return Contact.make({
			...this,
			...input,
		});
	}

	static fromDatabase<T extends ContactFromDatabase>(input: T) {
		return Contact.make({
			...input,
			recordId: ContactId.make(input.recordId),
			connectionId: ConnectionId.make(input.connectionId),
			recordCreatedAt: DateTime.unsafeMake(input.recordCreatedAt),
			recordUpdatedAt: DateTime.unsafeMake(input.recordUpdatedAt),
		});
	}
}
