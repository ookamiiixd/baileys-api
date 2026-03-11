import { useForm, useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { TextGradient } from "~/components/ui/text-gradient";
import { Auth, authAtom, authQueryOptions } from "~/lib/auth";
import { getRootErrorCause } from "~/lib/error";
import { httpClientAtom } from "~/lib/http-client";

export const authDialogOpenAtom = atom(false);

export function AuthDialog() {
	const [auth, setAuth] = useAtom(authAtom);
	const query = useQuery(authQueryOptions(auth));
	const [_, setHttpClient] = useAtom(httpClientAtom);

	const queryClient = useQueryClient();
	const [isOverrideOpen, setIsOverrideOpen] = useAtom(authDialogOpenAtom);

	useEffect(() => {
		if (query.data) {
			setHttpClient(query.data);
		}
	}, [query.data, setHttpClient]);

	const form = useForm({
		defaultValues: auth,
		canSubmitWhenInvalid: true,
		validators: { onSubmit: Auth },
		onSubmit: async ({ value, formApi }) => {
			try {
				const httpClient = await queryClient.fetchQuery(authQueryOptions(value));
				setAuth(value);
				setHttpClient(httpClient);
				setIsOverrideOpen(false);
				toast.success("Authenticated successfully.");
			} catch (error) {
				formApi.setErrorMap({
					onSubmit: { form: [getRootErrorCause(error)] },
				});
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

	useEffect(() => {
		if (query.isError) {
			form.setErrorMap({ onSubmit: { form: [getRootErrorCause(query.error)] } });
		}
	}, [query.isError, query.error, form.setErrorMap]);

	// Only display this on the initial load
	if (query.isPending && !isSubmitting) {
		return (
			<div className="fixed inset-0 z-50 w-full h-full bg-background flex flex-col items-center justify-center gap-6 p-4">
				<Spinner className="size-10" />
				<TextGradient className="text-xl text-center font-medium">
					Trying to authenticate using default credentials...
				</TextGradient>
			</div>
		);
	}

	const isOpen = !query?.data || isOverrideOpen;

	return (
		<Dialog open={isOpen}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Authentication</DialogTitle>
					<DialogDescription>
						Please provide your credentials to access the dashboard. If you didn't set the API key
						value in the environment variable, you may leave the API Key field empty.
					</DialogDescription>
				</DialogHeader>
				<form
					id="auth-form"
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
							name="baseUrl"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Base URL</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="http://localhost:3000"
											required
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
						<form.Field
							name="apiKey"
							children={(field) => {
								const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>API Key</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-invalid={isInvalid}
											placeholder="Enter your API key (optional)"
										/>
										{isInvalid && <FieldError errors={field.state.meta.errors} />}
									</Field>
								);
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					{query.data && (
						<Button
							variant="outline"
							onClick={() => setIsOverrideOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
					)}
					<Button type="submit" form="auth-form" disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Spinner data-icon="inline-start" />
								Saving...
							</>
						) : (
							"Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
