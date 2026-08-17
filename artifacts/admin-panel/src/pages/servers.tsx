import { useState } from "react";
import { useGetAdminGuilds, useKickFromGuild, getGetAdminGuildsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Server, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Servers() {
  const { data: guilds, isLoading } = useGetAdminGuilds();
  const kickMutation = useKickFromGuild();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const filteredGuilds = guilds?.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    g.id.includes(search)
  ) || [];

  const handleKick = (guildId: string, guildName: string) => {
    kickMutation.mutate({ guildId }, {
      onSuccess: () => {
        toast({
          title: "Connection Severed",
          description: `Successfully left ${guildName}`,
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: getGetAdminGuildsQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Operation Failed",
          description: err.error || "Could not leave the server.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <Server className="h-8 w-8 text-primary" />
            Network Nodes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage active server connections.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or ID..." 
            className="pl-9 bg-card/50 border-border focus-visible:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filteredGuilds.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No network nodes found matching your criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredGuilds.map((guild) => (
              <div key={guild.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border border-border">
                    <AvatarImage src={guild.iconUrl || undefined} />
                    <AvatarFallback className="bg-muted text-sm">{guild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground text-lg">{guild.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="font-mono text-primary/80">{guild.id}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span>Owner: <span className="font-mono">{guild.ownerId}</span></span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span>{guild.memberCount.toLocaleString()} units</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-end sm:w-auto">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        Sever Connection
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive uppercase tracking-wide">Confirm Severance</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to forcibly remove the bot from <strong>{guild.name}</strong>? 
                          This action is immediate and cannot be undone from this interface.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted text-muted-foreground hover:bg-muted/80">Abort</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleKick(guild.id, guild.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Execute Severance
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
