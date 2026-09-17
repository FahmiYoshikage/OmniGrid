"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotificationChannel {
  id: string;
  name: string;
  type: "telegram" | "discord" | "webhook" | "email";
  enabled: boolean;
  configMasked: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface NotificationDelivery {
  id: string;
  channelId: string | null;
  channelType: string;
  event: string;
  title: string;
  status: "success" | "failed";
  error: string | null;
  durationMs: number | null;
  createdAt: number;
}

export function NotificationSettingsCard() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New channel form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"telegram" | "discord" | "webhook" | "email">("telegram");
  // Telegram
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  // Discord
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  // Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  // Email
  const [emailTo, setEmailTo] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [channelsRes, deliveriesRes] = await Promise.all([
        fetch("/api/notifications/channels", { cache: "no-store" }),
        fetch("/api/notifications/deliveries?limit=10", { cache: "no-store" }),
      ]);

      if (channelsRes.ok) {
        const cData = (await channelsRes.json()) as { channels: NotificationChannel[] };
        setChannels(cData.channels || []);
      }
      if (deliveriesRes.ok) {
        const dData = (await deliveriesRes.json()) as { deliveries: NotificationDelivery[] };
        setDeliveries(dData.deliveries || []);
      }
    } catch {
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadData();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let config: Record<string, unknown> = {};
      if (type === "telegram") {
        if (!botToken.trim() || !chatId.trim()) {
          throw new Error("Bot Token and Chat ID are required for Telegram");
        }
        config = { botToken: botToken.trim(), chatId: chatId.trim() };
      } else if (type === "discord") {
        if (!discordWebhookUrl.trim()) {
          throw new Error("Discord Webhook URL is required");
        }
        config = { webhookUrl: discordWebhookUrl.trim() };
      } else if (type === "webhook") {
        if (!webhookUrl.trim()) {
          throw new Error("Target Webhook URL is required");
        }
        config = { url: webhookUrl.trim(), secret: webhookSecret.trim() || undefined };
      } else if (type === "email") {
        if (!emailTo.trim()) {
          throw new Error("Recipient email address is required");
        }
        config = {
          to: emailTo.trim(),
          ...(smtpHost.trim() ? { smtpHost: smtpHost.trim() } : {}),
          ...(smtpPort.trim() ? { smtpPort: Number(smtpPort.trim()) } : {}),
          ...(smtpUser.trim() ? { smtpUser: smtpUser.trim() } : {}),
          ...(smtpPass.trim() ? { smtpPass: smtpPass.trim() } : {}),
        };
      }

      const res = await fetch("/api/notifications/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `${type.toUpperCase()} Channel`,
          type,
          config,
          enabled: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create channel");
      }

      toast.success(`Notification channel "${name || type}" created`);
      setName("");
      setBotToken("");
      setChatId("");
      setDiscordWebhookUrl("");
      setWebhookUrl("");
      setWebhookSecret("");
      setEmailTo("");
      setSmtpHost("");
      setSmtpPort("");
      setSmtpUser("");
      setSmtpPass("");
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add channel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestChannel(id: string, channelName: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/notifications/channels/${id}/test`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Test dispatch failed");
      }
      toast.success(`Test alert sent to ${channelName}!`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test notification failed");
    } finally {
      setTestingId(null);
    }
  }

  async function handleDeleteChannel(id: string, channelName: string) {
    if (!confirm(`Are you sure you want to delete "${channelName}"?`)) return;
    try {
      const res = await fetch(`/api/notifications/channels/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete channel");
      }
      toast.success(`Channel "${channelName}" deleted`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete channel");
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-2xl shadow-black/10">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-amber-300" />
          Alert Notification Channels
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={channels.length ? "default" : "secondary"}>
            {channels.length} {channels.length === 1 ? "channel" : "channels"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-8 gap-1 border-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            {showAddForm ? "Cancel" : "Add Channel"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm leading-6 text-muted-foreground">
          Receive real-time notifications when service outages are detected by the Uptime Monitor,
          or when node incidents recover. Supported providers include Telegram, Discord, Email, and custom Webhooks.
        </p>

        {showAddForm && (
          <form onSubmit={handleAddChannel} className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
            <h4 className="text-sm font-semibold text-white">Add Notification Channel</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="channelName">Channel Name</Label>
                <Input
                  id="channelName"
                  placeholder="e.g. SRE Alerts, Discord Ops"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channelType">Provider Type</Label>
                <select
                  id="channelType"
                  value={type}
                  onChange={(e) => setType(e.target.value as "telegram" | "discord" | "webhook" | "email")}
                  className="h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white"
                  disabled={submitting}
                >
                  <option value="telegram">Telegram Bot</option>
                  <option value="discord">Discord Webhook</option>
                  <option value="webhook">Generic Webhook (HMAC-SHA256)</option>
                  <option value="email">Email Notification</option>
                </select>
              </div>
            </div>

            {type === "telegram" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="botToken">Telegram Bot Token</Label>
                  <Input
                    id="botToken"
                    type="password"
                    placeholder="123456789:ABCdef..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <p className="text-xs text-muted-foreground">From @BotFather</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chatId">Chat ID or Group ID</Label>
                  <Input
                    id="chatId"
                    placeholder="-100123456789 or 98765432"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Target recipient or group chat ID</p>
                </div>
              </div>
            )}

            {type === "discord" && (
              <div className="space-y-2">
                <Label htmlFor="discordWebhookUrl">Discord Webhook URL</Label>
                <Input
                  id="discordWebhookUrl"
                  type="password"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  disabled={submitting}
                  required
                />
                <p className="text-xs text-muted-foreground">Channel Settings &rarr; Integrations &rarr; Webhooks</p>
              </div>
            )}

            {type === "webhook" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://api.example.com/alerts"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">HMAC Secret (Optional)</Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    placeholder="secret-key-for-signature"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">Sent in X-OmniGrid-Signature header</p>
                </div>
              </div>
            )}

            {type === "email" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailTo">Recipient Email Address</Label>
                  <Input
                    id="emailTo"
                    type="email"
                    placeholder="alerts@yourdomain.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Direct recipient for incident reports and recoveries
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
                  <div className="text-xs font-medium text-zinc-400">
                    Custom SMTP (Optional — falls back to system SMTP if omitted)
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="smtpHost" className="text-xs">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.example.com"
                        className="h-8 text-xs"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="smtpPort" className="text-xs">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        className="h-8 text-xs"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="smtpUser" className="text-xs">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        placeholder="user@example.com"
                        className="h-8 text-xs"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="smtpPass" className="text-xs">SMTP Password</Label>
                      <Input
                        id="smtpPass"
                        type="password"
                        placeholder="••••••••"
                        className="h-8 text-xs"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Save Channel
              </Button>
            </div>
          </form>
        )}

        {/* Channels List */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Configured Channels</div>
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
              Loading notification channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-muted-foreground text-center">
              No notification channels configured yet. Click &quot;Add Channel&quot; to set up alerts.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{ch.name}</span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {ch.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configured: {new Date(ch.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={ch.enabled ? "default" : "secondary"}>
                      {ch.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => handleTestChannel(ch.id, ch.name)}
                      disabled={testingId === ch.id}
                    >
                      {testingId === ch.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeleteChannel(ch.id, ch.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Deliveries */}
        {deliveries.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Recent Alert Deliveries</div>
            <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-black/20">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    {d.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-medium text-white">{d.title}</span>
                      <span className="ml-2 text-muted-foreground">via {d.channelType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {d.durationMs != null && <span>{d.durationMs}ms</span>}
                    {d.error && <span className="text-red-400 truncate max-w-[150px]">{d.error}</span>}
                    <span>{new Date(d.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
