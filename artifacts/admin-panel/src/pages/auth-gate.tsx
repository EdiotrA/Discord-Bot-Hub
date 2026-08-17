import { useLocation } from "wouter";
import { useGetAdminMe, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Terminal } from "lucide-react";
import { useEffect } from "react";

export default function AuthGate() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useGetAdminMe({ query: { queryKey: getGetAdminMeQueryKey(), retry: false } });

  useEffect(() => {
    if (data && !isLoading) {
      setLocation("/dashboard");
    }
  }, [data, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  // Authenticated — effect above will redirect; render nothing while transitioning
  if (data && !error) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <Card className="w-full max-w-md p-8 bg-card/50 backdrop-blur-sm border-primary/20 shadow-[0_0_40px_-15px_rgba(0,255,255,0.2)]">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]">
            <Terminal className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Loopy Command Hub</h1>
            <p className="text-sm text-muted-foreground">
              Secure authentication required. Owner access only.
            </p>
          </div>

          <div className="w-full pt-4">
            <Button asChild className="w-full h-12 text-md font-medium tracking-wide uppercase group relative overflow-hidden">
              <a href="/api/admin/auth/discord">
                <span className="relative z-10">Authenticate via Discord</span>
                <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </a>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
