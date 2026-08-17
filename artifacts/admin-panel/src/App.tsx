import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import AuthGate from "@/pages/auth-gate";
import Dashboard from "@/pages/dashboard";
import Servers from "@/pages/servers";
import InviteManager from "@/pages/invite";
import { Shell } from "@/components/shell";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry on 4xx errors (especially 401 auth checks)
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={AuthGate} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/servers" component={Servers} />
        <Route path="/invite" component={InviteManager} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Router />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
