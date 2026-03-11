import {
	keepPreviousData,
	queryOptions,
	type UseQueryResult,
	useQuery,
} from "@tanstack/react-query";
import { formatRelativeTime } from "@wavvy/shared/date";
import type { ConnectionList } from "@wavvy/shared/modules/connections/routes";
import type { ConnectionWithStatus } from "@wavvy/shared/modules/connections/schema";
import { CursorFromBase64, PaginationParams } from "@wavvy/shared/pagination";
import { DateTime, Effect, Schema } from "effect";
import { atom, useAtom } from "jotai";
import {
	EditIcon,
	EllipsisIcon,
	KeyRoundIcon,
	PhoneOffIcon,
	PowerIcon,
	PowerOffIcon,
	QrCodeIcon,
	RefreshCwIcon,
	SmartphoneIcon,
	TrashIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldLabel } from "~/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemSeparator,
	ItemTitle,
} from "~/components/ui/item";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "~/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Status, StatusIndicator, StatusLabel, type StatusProps } from "~/components/ui/status";
import { useRequireHttpClient, type WavvyHttpClient } from "~/lib/http-client";
import { getInitials } from "~/lib/string";
import { ConnectionMutationDialog, connectionMutationDialogAtom } from "./mutation-dialog";

const StatusVariantMap: Record<ConnectionWithStatus["status"], StatusProps["variant"]> = {
	authenticated: "success",
	connected: "warning",
	connecting: "info",
	disconnected: "error",
};

const paginationAtom = atom<PaginationParams>({ limit: 25 });

function connectionListQueryOptions(client: WavvyHttpClient, pagination: PaginationParams) {
	const encodedPagination = Schema.encodeUnknownSync(PaginationParams)(pagination);
	return queryOptions({
		queryKey: ["connections", encodedPagination],
		placeholderData: keepPreviousData,
		queryFn: async () => await Effect.runPromise(client.Connections.list({ payload: pagination })),
	});
}

export function ConnectionsPage() {
	const [pagination] = useAtom(paginationAtom);
	const client = useRequireHttpClient();
	const query = useQuery(connectionListQueryOptions(client, pagination));

	const [, setMutationDialogProps] = useAtom(connectionMutationDialogAtom);

	return (
		<div className="flex flex-col gap-6">
			<div className="space-y-1">
				<h2 className="text-2xl font-semibold tracking-tight">Connections</h2>
				<p className="text-sm text-muted-foreground">
					Manage your connections, view connection status, and perform actions.
				</p>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex justify-end gap-2">
					<Button variant="outline" size="icon" onClick={() => query.refetch()}>
						<RefreshCwIcon />
						<span className="sr-only">Refresh</span>
					</Button>
					<Button onClick={() => setMutationDialogProps({ open: true, initialData: null })}>
						Add Connection
					</Button>
				</div>

				<ConnectionListPanel query={query} />
			</div>

			<ConnectionMutationDialog />
		</div>
	);
}

function ConnectionListPanel({ query }: { query: UseQueryResult<ConnectionList> }) {
	const [pagination, setPagination] = useAtom(paginationAtom);
	const [cursorStack, setCursorStack] = useState<NonNullable<PaginationParams["cursor"]>[]>([]);

	function handleSelectChange(value: string | null) {
		if (value) {
			setPagination(() => ({ cursor: undefined, limit: Number(value) }));
			setCursorStack([]);
		}
	}

	function handleNavigatePrevious() {
		const newStack = cursorStack.slice(0, -1);
		const cursor = newStack[newStack.length - 1];
		if (cursorStack.length <= 0) {
			return;
		}

		setCursorStack([...newStack]);
		setPagination((prev) => ({ ...prev, cursor }));
	}

	function handleNavigateNext() {
		const nextCursor = query.data?.pagination.nextCursor;
		if (!nextCursor) {
			return;
		}

		const cursor = Schema.decodeUnknownSync(CursorFromBase64)(nextCursor);
		setCursorStack([...cursorStack, cursor]);
		setPagination((prev) => ({ ...prev, cursor }));
	}

	return (
		<>
			<div className="overflow-hidden rounded-md border relative">
				<ConnectionListView data={query.data?.data ?? []} />
				{(query.isPending || (query.isFetching && query.isPlaceholderData)) && (
					<div className="absolute inset-0 bg-background/50 flex items-center justify-center">
						<Spinner className="size-8" />
					</div>
				)}
			</div>

			<div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
				<p className="text-sm text-muted-foreground">
					{query.data?.pagination.totalCount ?? 0} connections found
				</p>
				<div className="flex items-center justify-between gap-4">
					<Field orientation="horizontal" className="w-fit">
						<FieldLabel htmlFor="select-rows-per-page">Rows per page</FieldLabel>
						<Select value={pagination.limit.toString()} onValueChange={handleSelectChange}>
							<SelectTrigger className="w-20" id="select-rows-per-page">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="start">
								<SelectGroup>
									<SelectItem value="10">10</SelectItem>
									<SelectItem value="25">25</SelectItem>
									<SelectItem value="50">50</SelectItem>
									<SelectItem value="100">100</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Pagination className="mx-0 w-auto">
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									onClick={handleNavigatePrevious}
									disabled={cursorStack.length <= 0}
								/>
							</PaginationItem>
							<PaginationItem>
								<PaginationNext
									onClick={handleNavigateNext}
									disabled={!query.data?.pagination.nextCursor}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			</div>
		</>
	);
}

function ConnectionListView({ data }: { data: ConnectionList["data"] }) {
	const [, setMutationDialogProps] = useAtom(connectionMutationDialogAtom);

	if (data.length <= 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SmartphoneIcon />
					</EmptyMedia>
					<EmptyTitle>No Connections Yet</EmptyTitle>
					<EmptyDescription>
						You haven't added any connections yet. Get started by creating a new connection and
						linking your WhatsApp account.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button>Create Connection</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<ItemGroup className="gap-0">
			{data.map((connection, index) => (
				<Fragment key={connection.recordId}>
					<Item>
						<ItemMedia className="self-center!">
							<Avatar className="size-10">
								<AvatarImage src="" />
								<AvatarFallback>{getInitials(connection.name)}</AvatarFallback>
							</Avatar>
						</ItemMedia>
						<div className="flex-1 grid grid-flow-col auto-cols-fr items-center gap-4">
							<ItemContent className="flex-none">
								<ItemTitle>{connection.name}</ItemTitle>
								<ItemDescription className="font-mono">{connection.phoneNumber}</ItemDescription>
								<Status variant={StatusVariantMap[connection.status]} className="sm:hidden">
									<StatusIndicator />
									<StatusLabel>{connection.status}</StatusLabel>
								</Status>
							</ItemContent>
							<div className="hidden md:block space-y-1 text-sm">
								<p className="text-muted-foreground font-mono">
									proxies:
									{connection.config.proxyUrls?.length ?? 0}
								</p>
								<p className="text-muted-foreground font-mono">
									webhooks:
									{connection.config.webhooks?.length ?? 0}
								</p>
								{connection.config.shouldRejectCalls && (
									<div className="flex items-center gap-1 text-yellow-600">
										<PhoneOffIcon className="size-3.5" />
										<p className="font-mono">reject calls</p>
									</div>
								)}
							</div>
							<Status
								variant={StatusVariantMap[connection.status]}
								className="hidden sm:inline-flex"
							>
								<StatusIndicator />
								<StatusLabel>{connection.status}</StatusLabel>
							</Status>
							<p className="hidden md:block text-sm text-muted-foreground font-mono">
								updated {formatRelativeTime(DateTime.toDate(connection.recordUpdatedAt))}
							</p>
						</div>
						<ItemActions className="flex-none">
							<Dialog>
								<DialogTrigger
									render={
										<Button variant="ghost" size="icon" className="hidden md:inline-flex">
											<QrCodeIcon />
										</Button>
									}
								/>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>QR Code</DialogTitle>
										<DialogDescription>
											Scan the image below with your WhatsApp mobile app to connect your account.
										</DialogDescription>
									</DialogHeader>
									<img src="/github.svg" alt="github" className="w-full" />
									<DialogFooter>
										<DialogClose render={<Button variant="outline">Close</Button>} />
									</DialogFooter>
								</DialogContent>
							</Dialog>

							<Popover>
								<PopoverTrigger
									render={
										<Button variant="ghost" size="icon" className="hidden md:inline-flex">
											<KeyRoundIcon />
										</Button>
									}
								/>
								<PopoverContent align="end">
									<InputGroup>
										<InputGroupInput placeholder="AW12AWIJXA" readOnly />
										<InputGroupAddon align="inline-end">
											<CopyButton variant="ghost" size="xs" onCopy={() => "AWJAI21231"} />
										</InputGroupAddon>
									</InputGroup>
								</PopoverContent>
							</Popover>

							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button variant="ghost" size="icon">
											<EllipsisIcon />
										</Button>
									}
								/>
								<DropdownMenuContent className="min-w-40">
									<DropdownMenuItem
										onClick={() => setMutationDialogProps({ open: true, initialData: connection })}
									>
										<EditIcon />
										Edit
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem disabled={connection.status !== "connected"}>
										<QrCodeIcon />
										View QR Code
									</DropdownMenuItem>
									<DropdownMenuItem disabled={connection.status !== "connected"}>
										<KeyRoundIcon />
										View Pair Code
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>
										<PowerIcon />
										Reconnect
									</DropdownMenuItem>
									<DropdownMenuItem disabled={connection.status === "disconnected"}>
										<PowerOffIcon />
										Disconnect
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive">
										<TrashIcon />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</ItemActions>
					</Item>

					{index < data.length - 1 && <ItemSeparator />}
				</Fragment>
			))}
		</ItemGroup>
	);
}
