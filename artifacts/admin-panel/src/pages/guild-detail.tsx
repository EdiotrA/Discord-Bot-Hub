import { useState } from "react";
import {
  useGetGuildMembers,
  useGetGuildChannels,
  useKickGuildMember,
  useDeleteGuildChannel,
  getGetGuildMembersQueryKey,
  getGetGuildChannelsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Users, Hash, Search, UserMinus, Trash2, Bot, ShieldOff, FolderOpen } from "lucide-react";
import type { BotGuild } from "@workspace/api-client-react";

interface GuildDetailProps {
  guild: BotGuild | null;
  open: boolean;
  onClose: () => void;
}

// ─── Members Tab ───────────────────────────────────────────────────────────
function MembersTab({ guildId }: { guildId: string }) {
  const { data: members, isLoading } = useGetGuildMembers({ guildId, limit: 100 }, { query: { staleTime: 30_000 } });
  const kickMutation = useKickGuildMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [kickingId, setKickingId] = useState<string | null>(null);

  const filtered = members?.filter(m =>
    !m.isBot &&
    (m.username.toLowerCase().includes(search.toLowerCase()) ||
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.userId.includes(search))
  ) ?? [];

  const humans = members?.filter(m => !m.isBot) ?? [];
  const bots = members?.filter(m => m.isBot) ?? [];

  function handleKick(userId: string, name: string) {
    setKickingId(userId);
    kickMutation.mutate(
      { guildId, userId, data: { reason: "Kicked via Loopy Admin Panel" } },
      {
        onSuccess: () => {
          toast({ title: "Member Kicked", description: `${name} was removed from the server.` });
          queryClient.invalidateQueries({ queryKey: getGetGuildMembersQueryKey({ guildId, limit: 100 }) });
        },
        onError: (err) => {
          toast({ title: "Kick Failed", description: (err as { error?: string }).error ?? "Could not kick member.", variant: "destructive" });
        },
        onSettled: () => setKickingId(null),
      }
    );
  }

  if (isLoading) return (
    <div className="space-y-3 p-1">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {humans.length} humans</span>
        <span>·</span>
        <span className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" /> {bots.length} bots</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          className="pl-9 bg-background/50 border-border focus-visible:ring-primary"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No members match your search.</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[440px] overflow-y-auto pr-1">
          {filtered.map(m => (
            <div key={m.userId} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 border border-border flex-shrink-0">
                  <AvatarImage src={m.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs">{m.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{m.displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">@{m.username}</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity flex-shrink-0"
                    disabled={kickingId === m.userId}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive uppercase tracking-wide flex items-center gap-2">
                      <ShieldOff className="h-5 w-5" /> Kick Member
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Kick <strong>{m.displayName}</strong> (<span className="font-mono text-xs">@{m.username}</span>) from this server?
                      They can rejoin if an invite link is available.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleKick(m.userId, m.displayName)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Kick
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Channels Tab ──────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  Text: "#", Voice: "🔊", Announcement: "📢", Forum: "💬",
  Media: "🖼", Stage: "🎙", Category: "📁", Thread: "🧵",
};

function ChannelsTab({ guildId }: { guildId: string }) {
  const { data: channels, isLoading } = useGetGuildChannels({ guildId }, { query: { staleTime: 30_000 } });
  const deleteMutation = useDeleteGuildChannel();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = channels?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function handleDelete(channelId: string, channelName: string) {
    setDeletingId(channelId);
    deleteMutation.mutate(
      { guildId, channelId },
      {
        onSuccess: () => {
          toast({ title: "Channel Deleted", description: `#${channelName} has been permanently deleted.`, variant: "destructive" });
          queryClient.invalidateQueries({ queryKey: getGetGuildChannelsQueryKey({ guildId }) });
        },
        onError: (err) => {
          toast({ title: "Delete Failed", description: (err as { error?: string }).error ?? "Could not delete channel.", variant: "destructive" });
        },
        onSettled: () => setDeletingId(null),
      }
    );
  }

  if (isLoading) return (
    <div className="space-y-3 p-1">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );

  // Group by category
  const categories = new Map<string | null, typeof filtered>();
  filtered.forEach(c => {
    if (c.type === "Category") return; // show categories as headers
    const key = c.parentId ?? null;
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key)!.push(c);
  });

  const categoryNames = new Map(channels?.filter(c => c.type === "Category").map(c => [c.id, c.name]) ?? []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search channels..."
          className="pl-9 bg-background/50 border-border focus-visible:ring-primary"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.filter(c => c.type !== "Category").length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Hash className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No channels match your search.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
          {Array.from(categories.entries()).map(([catId, chans]) => (
            <div key={catId ?? "__none"}>
              {catId && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {categoryNames.get(catId) ?? catId}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {chans.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors group pl-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-muted-foreground text-sm flex-shrink-0">
                        {TYPE_ICON[c.type] ?? "#"}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">{c.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border flex-shrink-0">
                        {c.type}
                      </Badge>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity flex-shrink-0"
                          disabled={deletingId === c.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-destructive uppercase tracking-wide flex items-center gap-2">
                            <Trash2 className="h-5 w-5" /> Delete Channel
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete <strong>#{c.name}</strong>? This cannot be undone — all messages in this channel will be lost.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(c.id, c.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────
export default function GuildDetail({ guild, open, onClose }: GuildDetailProps) {
  if (!guild) return null;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-card/95 backdrop-blur-md border-l border-border p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border bg-background/30">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary/30">
              <AvatarImage src={guild.iconUrl ?? undefined} />
              <AvatarFallback className="bg-muted text-lg">{guild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-xl font-bold uppercase tracking-tight text-foreground truncate">
                {guild.name}
              </SheetTitle>
              <p className="text-xs text-primary/80 font-mono mt-0.5">{guild.id}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{guild.memberCount.toLocaleString()} members</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden p-6">
          <Tabs defaultValue="members" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-2 bg-background/50 border border-border mb-4 flex-shrink-0">
              <TabsTrigger value="members" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2">
                <Users className="h-4 w-4" /> Members
              </TabsTrigger>
              <TabsTrigger value="channels" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2">
                <Hash className="h-4 w-4" /> Channels
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="flex-1 mt-0">
              <MembersTab guildId={guild.id} />
            </TabsContent>
            <TabsContent value="channels" className="flex-1 mt-0">
              <ChannelsTab guildId={guild.id} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
