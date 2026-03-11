import { HttpApi, OpenApi } from "@effect/platform";
import { HttpApiDecodeError } from "@effect/platform/HttpApiError";
import packageJson from "../package.json" with { type: "json" };
import { connectionRoutes } from "./modules/connections/routes.js";
import { contactRoutes } from "./modules/contacts/routes.js";
import { UnexpectedError, ValidationError } from "./response.js";
import { SseResponse } from "./sse.js";

export const baileysApi = HttpApi.make("BaileysAPI")
	.add(connectionRoutes)
	.add(contactRoutes)
	.addError(ValidationError)
	.addError(UnexpectedError)
	.prefix("/api")
	.annotate(OpenApi.Title, "Baileys API")
	.annotate(OpenApi.Version, packageJson.version)
	.annotate(
		OpenApi.Description,
		"API documentation for the [Baileys API](https://github.com/ookamiiixd/baileys-api) project.",
	)
	.annotate(OpenApi.License, {
		name: "MIT",
		url: "https://github.com/ookamiiixd/baileys-api/blob/master/LICENSE",
	})
	.annotate(HttpApi.AdditionalSchemas, [SseResponse])
	// Override `HttpApiDecodeError` with `ValidationError`
	.annotate(OpenApi.Transform, (spec) => {
		const modifiedSpec = overrideRefs(spec);
		return {
			...modifiedSpec,
			components: {
				...modifiedSpec.components,
				schemas: {
					...modifiedSpec.components.schemas,
					HttpApiDecodeError: undefined,
				},
			},
		};
	});

function overrideRefs(obj: any): any {
	if (Array.isArray(obj)) {
		return obj.map(overrideRefs);
	}
	if (obj && typeof obj === "object") {
		const newObj: any = {};
		for (const key in obj) {
			if (
				key === "$ref" &&
				typeof obj[key] === "string" &&
				obj[key].endsWith(HttpApiDecodeError._tag)
			) {
				newObj[key] = obj[key].replace(HttpApiDecodeError._tag, ValidationError._tag);
			} else {
				newObj[key] = overrideRefs(obj[key]);
			}
		}
		return newObj;
	}
	return obj;
}
