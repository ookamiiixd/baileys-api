import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { AuthDialog } from "./components/auth-dialog";
import { Layout } from "./components/layout";
import { Toaster } from "./components/ui/sonner";
import { Dashboard } from "./dashboard";
import { useApplyTheme } from "./lib/theme";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false, // Handled by Effect http client
		},
	},
});

export function App() {
	useApplyTheme();

	return (
		<QueryClientProvider client={queryClient}>
			<Layout>
				<Dashboard />
			</Layout>
			<AuthDialog />
			<Toaster richColors />
			<TanStackDevtools
				plugins={[
					formDevtoolsPlugin(),
					{
						name: "TanStack Query",
						render: <ReactQueryDevtoolsPanel />,
					},
				]}
			/>
		</QueryClientProvider>
	);
}
