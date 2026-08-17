import { useState } from "react";
import {
  useGetAdminStats,
  useGetAdminGuilds,
  useGetGuildChannels,
  useSendChannelMessage,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Activity, Server, Users, Terminal, Clock, Send, Hash, Loader2, CheckCircle2 } from "lucide-react";

// ─── Stats + Recent Guilds ────────────────────────────────────────────────

function StatsSection() {
  const { data: stats, isLoading } = useGetAdminStats();

  const statCards = [
    { label: "Total Guilds", value: stats?.guildCount, icon: Server, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Members", value: stats?.totalMembers, icon: Users, color: "text-chart-3", bg: "bg-chart-3/10" },
    { label: "Commands Registered", value: stats?.commandCount, icon: Terminal, color: "text-chart-4", bg: "bg-chart-4/10" },
    { label: "System Uptime", value: stats ? formatUptime(stats.uptimeSeconds) : null, icon: Clock, color: "text-chart-2", bg: "bg-chart-2/10" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, i) => (
        <Card key={i} className="p-6 bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground mt-1">
                  {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ─── Channel Message Runner ───────────────────────────────────────────────

function ChannelRunner() {
  const { data: guilds, isLoading: guildsLoading } = useGetAdminGuilds();
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [lastSent, setLastSent] = useState(false);

  const { data: channels, isLoading: channelsLoading } = useGetGuildChannels(
    selectedGuildId,
    { query: { enabled: !!selectedGuildId, staleTime: 30_000 } }
  );

  const sendMutation = useSendChannelMessage();
  const { toast } = useToast();

  // Only show sendable text channels (type 0=Text, 5=Announcement)
  const textChannels = channels?.filter(c =>
    c.type === "Text" || c.type === "Announcement"
  ) ?? [];

  const selectedGuild = guilds?.find(g => g.id === selectedGuildId);
  const selectedChannel = channels?.find(c => c.id === selectedChannelId);

  function handleGuildChange(guildId: string) {
    setSelectedGuildId(guildId);
    setSelectedChannelId("");
    setLastSent(false);
  }

  function handleSend() {
    if (!selectedChannelId || !message.trim()) return;
    setLastSent(false);
    sendMutation.mutate(
      { data: { channelId: selectedChannelId, content: message.trim() } },
      {
        onSuccess: () => {
          toast({
            title: "Message Sent",
            description: `Delivered to #${selectedChannel?.name ?? selectedChannelId} in ${selectedGuild?.name}`,
          });
          setMessage("");
          setLastSent(true);
          setTimeout(() => setLastSent(false), 3000);
        },
        onError: (err) => {
          toast({
            title: "Send Failed",
            description: (err as { error?: string }).error ?? "Could not send message — check bot permissions",
            variant: "destructive",
          });
        },
      }
    );
  }

  const canSend = !!selectedChannelId && message.trim().length > 0 && !sendMutation.isPending;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border/50 bg-background/20">
        <h2 className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Send to Channel
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick a server and channel — the bot delivers your message directly.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Step 1: Pick Server */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">1</span>
            Server
          </label>
          {guildsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedGuildId} onValueChange={handleGuildChange}>
              <SelectTrigger className="bg-background/50 border-border focus:ring-primary">
                <SelectValue placeholder="Choose a server…">
                  {selectedGuild && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedGuild.iconUrl ?? undefined} />
                        <AvatarFallback className="text-[8px] bg-muted">{selectedGuild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{selectedGuild.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-64">
                {(guilds ?? []).sort((a, b) => a.name.localeCompare(b.name)).map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={g.iconUrl ?? undefined} />
                        <AvatarFallback className="text-[8px] bg-muted">{g.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{g.name}</span>
                      <span className="text-muted-foreground text-xs ml-auto">{g.memberCount.toLocaleString()} members</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Step 2: Pick Channel */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">2</span>
            Channel
          </label>
          {selectedGuildId && channelsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={selectedChannelId}
              onValueChange={setSelectedChannelId}
              disabled={!selectedGuildId || channelsLoading}
            >
              <SelectTrigger className="bg-background/50 border-border focus:ring-primary disabled:opacity-40">
                <SelectValue placeholder={selectedGuildId ? (channelsLoading ? "Loading channels…" : "Choose a channel…") : "Pick a server first"} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-64">
                {textChannels.length === 0 && !channelsLoading && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">No text channels found</div>
                )}
                {textChannels.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{c.name}</span>
                      {c.parentName && (
                        <span className="text-muted-foreground text-xs ml-auto opacity-60">{c.parentName}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Step 3: Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">3</span>
            Message
          </label>
          <Textarea
            placeholder="Type your message here…"
            className="bg-background/50 border-border focus-visible:ring-primary resize-none min-h-[100px] font-mono text-sm"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSend) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!selectedChannelId}
          />
          <p className="text-[11px] text-muted-foreground">
            {message.length > 0 && <span className={message.length > 1900 ? "text-destructive" : ""}>{message.length}/2000 chars</span>}
            {message.length === 0 && "Ctrl+Enter to send"}
          </p>
        </div>

        {/* Send Button */}
        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-wider font-bold"
          disabled={!canSend || message.length > 2000}
          onClick={handleSend}
        >
          {sendMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : lastSent ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
              Sent!
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// ─── Recent Guilds ────────────────────────────────────────────────────────

function RecentGuilds() {
  const { data: guilds, isLoading } = useGetAdminGuilds();

  const recentGuilds = guilds
    ? [...guilds].sort((a, b) => {
        if (!a.joinedAt) return 1;
        if (!b.joinedAt) return -1;
        return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      }).slice(0, 5)
    : [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground uppercase flex items-center gap-2">
        <Server className="h-5 w-5 text-muted-foreground" />
        Recent Incursions
      </h2>
      <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
        {isLoading ? (
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
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{guild.memberCount.toLocaleString()} units</span>
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  {guild.joinedAt && (
                    <p className="text-muted-foreground">
                      {new Date(guild.joinedAt).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          System Status
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Real-time telemetry and global network metrics.</p>
      </div>

      <StatsSection />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentGuilds />
        <ChannelRunner />
      </div>
    </div>
  );
}
