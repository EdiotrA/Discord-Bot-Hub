import { useState } from "react";
import { 
  useGetInviteTargets, 
  useAddInviteTarget, 
  useRemoveInviteTarget, 
  getGetInviteTargetsQueryKey 
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LinkIcon, Plus, Copy, Trash2, CheckCircle2, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const addTargetSchema = z.object({
  guildId: z.string().min(1, "Server ID is required").regex(/^\d+$/, "Must be a valid numeric ID"),
  label: z.string().optional(),
});

type AddTargetFormValues = z.infer<typeof addTargetSchema>;

export default function InviteManager() {
  const { data: targets, isLoading } = useGetInviteTargets();
  const addMutation = useAddInviteTarget();
  const removeMutation = useRemoveInviteTarget();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const form = useForm<AddTargetFormValues>({
    resolver: zodResolver(addTargetSchema),
    defaultValues: {
      guildId: "",
      label: "",
    },
  });

  const onSubmit = (data: AddTargetFormValues) => {
    addMutation.mutate({ data: { guildId: data.guildId, label: data.label || undefined } }, {
      onSuccess: () => {
        toast({
          title: "Target Authorized",
          description: "New server added to the force-invite manifest.",
        });
        queryClient.invalidateQueries({ queryKey: getGetInviteTargetsQueryKey() });
        setIsAddDialogOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({
          title: "Authorization Failed",
          description: err.error || "Could not add target.",
          variant: "destructive",
        });
      }
    });
  };

  const handleRemove = (targetId: number) => {
    removeMutation.mutate({ targetId }, {
      onSuccess: () => {
        toast({
          title: "Target Revoked",
          description: "Server removed from manifest.",
        });
        queryClient.invalidateQueries({ queryKey: getGetInviteTargetsQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Revocation Failed",
          description: err.error || "Could not remove target.",
          variant: "destructive",
        });
      }
    });
  };

  const copyLink = (id: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({
      title: "Link Copied",
      description: "Force-invite URL copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
            <LinkIcon className="h-8 w-8 text-primary" />
            Invite Manifest
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Force-invite generation for high-value targets.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Authorize New Target
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wide text-primary">Authorize Target Server</DialogTitle>
              <DialogDescription>
                Input the raw Server ID to generate a dedicated integration payload.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="guildId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs text-muted-foreground">Target Server ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 123456789012345678" className="font-mono bg-background border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase text-xs text-muted-foreground">Designation (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Project Alpha Hub" className="bg-background border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addMutation.isPending} className="bg-primary text-primary-foreground">
                    {addMutation.isPending ? "Authorizing..." : "Authorize Target"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden">
        <div className="p-4 bg-muted/20 border-b border-border text-sm text-muted-foreground">
          <Shield className="h-4 w-4 inline-block mr-2 text-primary" />
          Instructions: Generate a link below, open it in your browser, and authorize the bot into the target server.
        </div>
        
        {isLoading ? (
          <div className="p-8 flex flex-col gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : !targets || targets.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No pending integrations in manifest.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {targets.map((target) => (
              <div key={target.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground text-lg">
                      {target.label || "Unnamed Target"}
                    </span>
                    {target.botAlreadyIn ? (
                      <Badge variant="outline" className="border-chart-3 text-chart-3 bg-chart-3/10 uppercase text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-chart-2 text-chart-2 bg-chart-2/10 uppercase text-[10px]">Pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">ID: {target.guildId}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span>Added {new Date(target.addedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => copyLink(target.id, target.inviteUrl)}
                  >
                    {copiedId === target.id ? (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copiedId === target.id ? "Copied" : "Copy Payload"}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemove(target.id)}
                    title="Remove from manifest"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}