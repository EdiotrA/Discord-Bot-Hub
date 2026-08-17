import { useGetAdminStats, useGetAdminGuilds } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Activity, Server, Users, Terminal, Clock } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: guilds, isLoading: guildsLoading } = useGetAdminGuilds();

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const statCards = [
    { label: "Total Guilds", value: stats?.guildCount, icon: Server, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Members", value: stats?.totalMembers, icon: Users, color: "text-chart-3", bg: "bg-chart-3/10" },
    { label: "Commands Executed", value: stats?.commandCount, icon: Terminal, color: "text-chart-4", bg: "bg-chart-4/10" },
    { label: "System Uptime", value: stats ? formatUptime(stats.uptimeSeconds) : null, icon: Clock, color: "text-chart-2", bg: "bg-chart-2/10" },
  ];

  const recentGuilds = guilds ? [...guilds].sort((a, b) => {
    if (!a.joinedAt) return 1;
    if (!b.joinedAt) return -1;
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  }).slice(0, 5) : [];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            System Status
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time telemetry and global network metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground uppercase flex items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          Recent Incursions
        </h2>
        
        <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
          {guildsLoading ? (
            <div className="p-8 flex flex-col gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : recentGuilds.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No network connections established.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentGuilds.map((guild) => (
                <div key={guild.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={guild.iconUrl || undefined} />
                      <AvatarFallback className="bg-muted text-xs">{guild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{guild.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>ID: {guild.id}</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span>{guild.memberCount.toLocaleString()} units</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {guild.joinedAt && (
                      <p className="text-muted-foreground">
                        {new Date(guild.joinedAt).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
