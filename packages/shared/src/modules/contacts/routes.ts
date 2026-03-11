import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform";
import { Schema as S } from "effect";
import { PaginationMetadata, PaginationParams } from "../../pagination.js";
import { SuccessResponse } from "../../response.js";
import { Authentication } from "../auth/middlewares.js";
import { WithConnection } from "../connections/middlewares.js";
import { ConnectionNotFound } from "../connections/routes.js";
import { Contact } from "./schema.js";

export class ContactList extends S.TaggedClass<ContactList>()("ContactList", {
	...SuccessResponse.fields,
	data: S.Array(Contact),
	pagination: PaginationMetadata,
}) {}

const list = HttpApiEndpoint.get("list", "/")
	.setPayload(PaginationParams.pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" })))
	.addSuccess(ContactList)
	.annotate(OpenApi.Summary, "List Contacts")
	.annotate(OpenApi.Description, "Get a list of all saved contacts.");

export const contactRoutes = HttpApiGroup.make("Contacts")
	.add(list)
	.addError(ConnectionNotFound)
	.prefix("/contacts")
	.middleware(Authentication)
	.middleware(WithConnection)
	.annotate(OpenApi.Description, "Contact related endpoints.");
