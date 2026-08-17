import { useState } from "react";
import { useGetAdminCommands } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Search, Globe, Server } from "lucide-react";

const COMMAND_TYPE: Record<number, { label: string; color: string }> = {
  1: { label: "Slash", color: "text-primary bg-primary/10 border-primary/20" },
  2: { label: "User", color: "text-chart-3 bg-chart-3/10 border-chart-3/20" },
  3: { label: "Message", color: "text-chart-4 bg-chart-4/10 border-chart-4/20" },
};

export default function Commands() {
  const { data: commands, isLoading } = useGetAdminCommands({ query: { staleTime: 120_000 } });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = commands?.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" ||
      (typeFilter === "global" && !c.guildId) ||
      (typeFilter === "guild" && !!c.guildId);
    return matchSearch && matchType;
  }) ?? [];

  const globalCount = commands?.filter(c => !c.guildId).length ?? 0;
  const guildCount = commands?.filter(c => !!c.guildId).length ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Terminal className="h-8 w-8 text-primary" />
            Command Registry
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">All registered slash commands deployed to Discord.</p>
        </div>

        {/* Stats */}
        {!isLoading && commands && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-center px-4 py-2 rounded-lg border border-border bg-card/50">
              <p className="text-2xl font-bold text-primary">{commands.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
            <div className="text-center px-4 py-2 rounded-lg border border-border bg-card/50">
              <p className="text-2xl font-bold text-chart-3">{globalCount}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Global</p>
            </div>
            <div className="text-center px-4 py-2 rounded-lg border border-border bg-card/50">
              <p className="text-2xl font-bold text-chart-4">{guildCount}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Guild</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands..."
            className="pl-9 bg-card/50 border-border focus-visible:ring-primary"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: "all", label: "All", icon: Terminal },
            { key: "global", label: "Global", icon: Globe },
            { key: "guild", label: "Guild-only", icon: Server },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                typeFilter === f.key
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card/50 text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Command grid */}
      <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
        {isLoading ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Terminal className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No commands match your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(cmd => {
              const typeInfo = COMMAND_TYPE[cmd.type] ?? { label: `Type ${cmd.type}`, color: "text-muted-foreground bg-muted/20 border-border" };
              return (
                <div key={cmd.id} className="p-4 flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors group">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 w-8 h-8 rounded-md bg-primary/5 border border-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-bold">/</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-sm font-semibold text-foreground">{cmd.name}</code>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${typeInfo.color}`} variant="outline">
                          {typeInfo.label}
                        </Badge>
                        {cmd.guildId && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                            <Server className="h-2.5 w-2.5 mr-1" />
                            Guild
                          </Badge>
                        )}
                        {!cmd.guildId && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                            <Globe className="h-2.5 w-2.5 mr-1" />
                            Global
                          </Badge>
                        )}
                      </div>
                      {cmd.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{cmd.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/50 font-mono flex-shrink-0 hidden group-hover:block">{cmd.id}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
