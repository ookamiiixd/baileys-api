import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Connection, CreateConnection } from "@wavvy/shared/modules/connections/schema";
import { ArrayFromString, RecordFromJsonString } from "@wavvy/shared/schema";
import { Effect, Schema as S } from "effect";
import { atom, useAtom } from "jotai";
import { XIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "~/components/ui/input-group";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { getRootErrorCause } from "~/lib/error";
import { useRequireHttpClient } from "~/lib/http-client";

const StandardCreateConnection = CreateConnection.pipe(
	S.omit("config"),
	S.extend(
		S.Struct({
			config: S.Struct({
				shouldRejectCalls: S.Boolean,
				proxyUrls: S.Array(S.URL).pipe(S.mutable),
				webhooks: S.Array(
					S.Struct({
						url: S.URL,
						authToken: S.String,
						events: ArrayFromString,
					}),
				).pipe(S.mutable),
				baileysConfig: RecordFromJsonString,
			}),
		}),
	),
	S.standardSchemaV1,
);

export const connectionMutationDialogAtom = atom({
	open: false,
	initialData: null as Connection | null,
});

export function ConnectionMutationDialog() {
	const [props, setProps] = useAtom(connectionMutationDialogAtom);
	const initialData = useMemo<typeof StandardCreateConnection.Encoded | null>(() => {
		if (!props.initialData) {
			return null;
		}

		return {
			...props.initialData,
			config: {
				shouldRejectCalls: props.initialData.config.shouldRejectCalls,
				proxyUrls: props.initialData.config.proxyUrls?.map((url) => url.toString()) ?? [],
				webhooks:
					props.initialData.config.webhooks?.map((webhook) => ({
						url: webhook.url.toString(),
						authToken: webhook.authToken ?? "",
						events: webhook.events ? webhook.events.join(",") : "",
					})) ?? [],
				baileysConfig: JSON.stringify(props.initialData.config.baileysConfig ?? {}),
			},
			shouldConnect: false,
		};
	}, [props.initialData]);

	const httpClient = useRequireHttpClient();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (payload: CreateConnection) => {
			const action = initialData ? "update" : "create";
			await Effect.runPromise(
				httpClient.Connections[action]({
					payload,
					path: { connectionId: props.initialData?.recordId as any },
				}),
			);

			await queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onSuccess: () => {
			toast.success(`Connection ${initialData ? "updated" : "created"} successfully.`);
		},
	});

	const form = useForm({
		defaultValues: (initialData ?? {
			name: "",
			phoneNumber: "",
			config: {
				shouldRejectCalls: false,
				proxyUrls: [],
				webhooks: [],
				baileysConfig: "{}",
			},
			shouldConnect: false,
		}) as typeof StandardCreateConnection.Encoded,
		canSubmitWhenInvalid: true,
		validators: { onSubmit: StandardCreateConnection },
		onSubmit: async ({ value, formApi }) => {
			try {
				const decoded = S.decodeUnknownSync(StandardCreateConnection)(value);
				const proxyUrls = decoded.config.proxyUrls.map((url) => url.toString());
				const webhooks = decoded.config.webhooks.map((webhook) => ({
					...webhook,
					url: webhook.url.toString(),
				}));

				const payload = S.decodeUnknownSync(CreateConnection)({
					...decoded,
					config: {
						...decoded.config,
						proxyUrls,
						webhooks,
					},
				});
				await mutation.mutateAsync(payload);

				setProps({ open: false, initialData: null });
				formApi.reset();
			} catch (error) {
				formApi.setErrorMap({
					onSubmit: { form: [getRootErrorCause(error)] },
				});
			}
		},
	});

	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				setProps((prev) => ({ ...prev, open }));
				if (!open) {
					form.reset();
				}
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{initialData ? "Update Connection" : "Create Connection"}</DialogTitle>
					<DialogDescription>
						{initialData
							? "Update the details of your connection below."
							: "Fill in the details of your new connection below."}
					</DialogDescription>
				</DialogHeader>

				<form
					id={form.formId}
					className="flex-1 overflow-y-auto px-6 py-3"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Subscribe
							selector={(state) => state.errorMap.onSubmit?.form}
							children={(errors) => <FieldError {...(errors && { errors })} />}
						/>

						<form.Field
							name="name"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Name</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="My Connection"
											required
										/>
										<FieldDescription>
											A descriptive name for your connection (e.g., "Office WhatsApp").
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>

						<form.Field
							name="phoneNumber"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Phone Number</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="6281234567890"
											required
										/>
										<FieldDescription>
											The phone number associated with this connection in E.164 format without the
											"+" sign (e.g., "6281234567890")
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>

						<form.Field
							name="config.shouldRejectCalls"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field orientation="horizontal" data-invalid={isInvalid}>
										<FieldContent>
											<FieldLabel htmlFor={field.name}>Reject Incoming Calls</FieldLabel>
											<FieldDescription>
												Enable this option to automatically reject all incoming calls on this
												connection.
											</FieldDescription>
											{isInvalid && <FieldError errors={field.state.meta.errors} />}
										</FieldContent>
										<Switch
											id={field.name}
											name={field.name}
											checked={field.state.value}
											onCheckedChange={field.handleChange}
											aria-invalid={isInvalid}
										/>
									</Field>
								);
							}}
						/>

						<form.Field name="config.proxyUrls" mode="array">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<FieldSet className="gap-4">
										<FieldLegend variant="label">Proxy URLs</FieldLegend>
										<FieldDescription>
											Add proxy URLs to route your connection's traffic through.
										</FieldDescription>
										<FieldGroup className="gap-4">
											{field.state.value?.map((_, index) => (
												<form.Field
													key={index}
													name={`config.proxyUrls[${index}]`}
													children={(subField) => {
														const isSubFieldInvalid =
															subField.state.meta.isTouched && !subField.state.meta.isValid;
														return (
															<Field data-invalid={isSubFieldInvalid}>
																<FieldContent>
																	<InputGroup>
																		<InputGroupInput
																			id={subField.name}
																			name={subField.name}
																			value={subField.state.value}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			aria-invalid={isSubFieldInvalid}
																			placeholder="https://user:pass@my-proxy.com"
																			type="url"
																			required
																		/>
																		<InputGroupAddon align="inline-end">
																			<InputGroupButton
																				type="button"
																				variant="ghost"
																				size="icon-xs"
																				onClick={() => field.removeValue(index)}
																				aria-label={`Remove proxy url ${index + 1}`}
																			>
																				<XIcon />
																			</InputGroupButton>
																		</InputGroupAddon>
																	</InputGroup>
																	{isSubFieldInvalid && (
																		<FieldError errors={subField.state.meta.errors} />
																	)}
																</FieldContent>
															</Field>
														);
													}}
												/>
											))}
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => field.pushValue("")}
											>
												Add Proxy URL
											</Button>
										</FieldGroup>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</FieldSet>
								);
							}}
						</form.Field>

						<form.Field name="config.webhooks" mode="array">
							{(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<FieldSet className="gap-4">
										<FieldLegend variant="label">Webhooks</FieldLegend>
										<FieldDescription>
											Configure webhooks to receive real-time updates about events on this
											connection.
										</FieldDescription>
										<FieldGroup className="gap-4">
											{field.state.value?.map((_, index) => (
												<div key={index} className="flex items-center gap-3 pt-3 border-t">
													<FieldGroup className="gap-4">
														<form.Field
															name={`config.webhooks[${index}].url`}
															children={(subField) => {
																const isSubFieldInvalid =
																	subField.state.meta.isTouched && !subField.state.meta.isValid;
																return (
																	<Field data-invalid={isSubFieldInvalid}>
																		<Input
																			id={subField.name}
																			name={subField.name}
																			value={subField.state.value}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			aria-invalid={isSubFieldInvalid}
																			placeholder="https://my-webhook-receiver.com/webhook"
																			type="url"
																			required
																		/>
																		{isSubFieldInvalid && (
																			<FieldError errors={subField.state.meta.errors} />
																		)}
																	</Field>
																);
															}}
														/>

														<form.Field
															name={`config.webhooks[${index}].authToken`}
															children={(subField) => {
																const isSubFieldInvalid =
																	subField.state.meta.isTouched && !subField.state.meta.isValid;
																return (
																	<Field data-invalid={isSubFieldInvalid}>
																		<Input
																			id={subField.name}
																			name={subField.name}
																			value={subField.state.value}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			aria-invalid={isSubFieldInvalid}
																			placeholder="Optional auth token for this webhook"
																		/>
																		{isSubFieldInvalid && (
																			<FieldError errors={subField.state.meta.errors} />
																		)}
																	</Field>
																);
															}}
														/>

														<form.Field
															name={`config.webhooks[${index}].events`}
															children={(subField) => {
																const isSubFieldInvalid =
																	subField.state.meta.isTouched && !subField.state.meta.isValid;
																return (
																	<Field data-invalid={isSubFieldInvalid}>
																		<Textarea
																			id={subField.name}
																			name={subField.name}
																			value={subField.state.value}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			aria-invalid={isSubFieldInvalid}
																			placeholder="Comma separated list of event names to subscribe to (e.g., connection.update, messages.upsert). Leave empty to receive all events."
																			className="min-h-16"
																		/>
																		{isSubFieldInvalid && (
																			<FieldError errors={subField.state.meta.errors} />
																		)}
																	</Field>
																);
															}}
														/>
													</FieldGroup>
													<Button
														type="button"
														variant="ghost"
														size="icon-xs"
														onClick={() => field.removeValue(index)}
														aria-label={`Remove webhook ${index + 1}`}
													>
														<XIcon />
													</Button>
												</div>
											))}
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => field.pushValue({ url: "", authToken: "", events: "" })}
											>
												Add Webhook
											</Button>
										</FieldGroup>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</FieldSet>
								);
							}}
						</form.Field>

						<form.Field
							name="config.baileysConfig"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Custom Baileys Config (JSON)</FieldLabel>
										<Textarea
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Enter your custom Baileys config as valid JSON string..."
											className="h-24"
										/>
										<FieldDescription>
											Optional custom configuration to pass to the Baileys socket instance. Must be
											a valid JSON string representing an object with key-value pairs corresponding
											to Baileys config options.
										</FieldDescription>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>

						<form.Field
							name="shouldConnect"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field orientation="horizontal" data-invalid={isInvalid}>
										<FieldContent>
											<FieldLabel htmlFor={field.name}>
												{initialData ? "Reconnect" : "Connect"} After Saving
											</FieldLabel>
											<FieldDescription>
												Enable this option to automatically{" "}
												{initialData ? "reconnect" : "establish"} the connection immediately after
												saving. If disabled, the connection will be created/updated but remain on
												its current state until you manually reconnect it later.
											</FieldDescription>
											{isInvalid && <FieldError errors={field.state.meta.errors} />}
										</FieldContent>
										<Switch
											id={field.name}
											name={field.name}
											checked={field.state.value}
											onCheckedChange={field.handleChange}
											aria-invalid={isInvalid}
										/>
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>

				<DialogFooter>
					<DialogClose render={<Button variant="outline">Cancel</Button>} />
					<form.Subscribe
						selector={(state) => state.isSubmitting}
						children={(isSubmitting) => (
							<Button type="submit" form={form.formId} disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Spinner data-icon="inline-start" />
										Saving...
									</>
								) : (
									"Save"
								)}
							</Button>
						)}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
