"use client";

import { Cloud, CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDriveSync } from "@/lib/cloud-sync";

function StatusLine({
  state,
  message,
}: {
  state: ReturnType<typeof useDriveSync>["state"];
  message: string;
}) {
  if (!message) return null;
  const color =
    state === "error"
      ? "text-destructive"
      : state === "ok"
        ? "text-emerald-600"
        : "text-muted-foreground";
  return <p className={`text-sm ${color}`}>{message}</p>;
}

export function CloudSyncCard() {
  const sync = useDriveSync();
  const busy = sync.state === "working";

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {sync.connected ? (
            <Cloud className="h-5 w-5 text-emerald-600" />
          ) : (
            <CloudOff className="h-5 w-5 text-muted-foreground" />
          )}
          Storage mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Per device (default):</strong>{" "}
            your portfolio stays in this browser only. Nothing leaves the
            device.
          </p>
          <p className="mt-1">
            <strong className="text-foreground">Google Drive sync:</strong>{" "}
            store one private portfolio file in your own Google Drive so you can
            load the same data on your PC, phone, and other devices. The file
            lives in a hidden, app-only folder — it never appears in your normal
            Drive and is not shared with anyone.
          </p>
        </div>

        {!sync.clientIdLocked && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="gdrive-client-id">
              Google OAuth Client ID
            </label>
            <Input
              id="gdrive-client-id"
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              value={sync.clientId}
              onChange={(event) => sync.setClientId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              One-time setup. Create an OAuth Client ID (type: Web application)
              in the Google Cloud Console, add this site to its authorized
              JavaScript origins, then paste the ID here. See the README for
              step-by-step instructions. This ID is public, not a secret.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {sync.connected ? (
            <Button
              variant="outline"
              onClick={sync.disconnect}
              disabled={busy}
            >
              <CloudOff className="h-4 w-4" /> Disconnect
            </Button>
          ) : (
            <Button onClick={sync.connect} disabled={busy || !sync.clientId}>
              <Cloud className="h-4 w-4" /> Connect Google Drive
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={sync.push}
            disabled={busy || !sync.clientId}
          >
            <UploadCloud className="h-4 w-4" /> Push to Drive
          </Button>
          <Button
            variant="secondary"
            onClick={sync.pull}
            disabled={busy || !sync.clientId}
          >
            <RefreshCw className="h-4 w-4" /> Pull from Drive
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={sync.autoPull}
            onChange={(event) => sync.setAutoPull(event.target.checked)}
          />
          Auto-pull from Drive when I open the app on this device
        </label>

        <StatusLine state={sync.state} message={sync.message} />

        {sync.lastSynced && (
          <p className="text-xs text-muted-foreground">
            Last Drive sync: {new Date(sync.lastSynced).toLocaleString()}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Pushing overwrites the Drive copy with this device. Pulling overwrites
          this device with the Drive copy and reloads the page. Use Push after
          editing, Pull on a fresh device.
        </p>
      </CardContent>
    </Card>
  );
}
