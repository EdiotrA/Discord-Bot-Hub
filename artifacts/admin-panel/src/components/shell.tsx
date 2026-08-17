import { Link, useLocation } from "wouter";
import { useGetAdminMe, useAdminLogout, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, Server, Link as LinkIcon, LogOut, Terminal, Activity, Code2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, error } = useGetAdminMe({ query: { queryKey: getGetAdminMeQueryKey(), retry: false } });
  const logout = useAdminLogout();

  useEffect(() => {
    // If we're on an authenticated route and we know there's an error/no user, redirect
    if (!isLoading && (error || !user) && location !== "/") {
      setLocation("/");
    }
  }, [isLoading, error, user, location, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminMeQueryKey() });
        setLocation("/");
      }
    });
  };

  // If loading or we are on the auth gate, render without sidebar
  if (isLoading || location === "/") {
    return <>{children}</>;
  }

  // If not loading, not on auth gate, and no user (meaning the redirect is about to happen)
  if (!user) {
    return null;
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/servers", label: "Servers", icon: Server },
    { href: "/commands", label: "Commands", icon: Code2 },
    { href: "/invite", label: "Invite Manager", icon: LinkIcon },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/30 flex flex-col relative z-20 backdrop-blur-md">
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm tracking-widest uppercase text-foreground">Loopy Hub</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer group ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1 h-1 rounded-full bg-primary animate-pulse shadow-[0_0_5px_rgba(0,255,255,0.8)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Area */}
        <div className="p-4 border-t border-border bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="bg-muted text-xs uppercase">{user.username.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{user.username}</span>
                <span className="text-[10px] text-primary uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-3 w-3" /> System Admin
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]">
        {children}
      </main>
    </div>
  );
}
