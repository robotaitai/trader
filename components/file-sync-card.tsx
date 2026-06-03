"use client";

import { useRef } from "react";
import {
  Download,
  FileUp,
  FolderSync,
  Link2,
  Link2Off,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFileSync } from "@/lib/file-sync";

export function FileSyncCard() {
  const sync = useFileSync();
  const importInput = useRef<HTMLInputElement>(null);
  const busy = sync.state === "working";

  const statusColor =
    sync.state === "error"
      ? "text-destructive"
      : sync.state === "ok"
        ? "text-emerald-600"
        : "text-muted-foreground";

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderSync className="h-5 w-5 text-muted-foreground" />
          Storage mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          Your portfolio lives in this browser by default. To use it across
          devices, keep it as a file and let a drive you already sync (Google
          Drive, iCloud, Dropbox) carry it between machines. The app never
          uploads anything anywhere.
        </div>

        {/* Export / Import — works everywhere, including phones */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Export / Import a file</h3>
            <p className="text-xs text-muted-foreground">
              Download your portfolio as a file, or load one. Works on any
              device, including phones. Move the file via any cloud drive,
              AirDrop, or email.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={sync.exportDownload} disabled={busy}>
              <Download className="h-4 w-4" /> Download my data
            </Button>
            <Button
              variant="secondary"
              onClick={() => importInput.current?.click()}
              disabled={busy}
            >
              <FileUp className="h-4 w-4" /> Load data from file
            </Button>
            <input
              ref={importInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sync.importFromFile(file);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Link a file — auto-save (desktop Chromium only) */}
        <div className="space-y-3 border-t pt-5">
          <div>
            <h3 className="text-sm font-semibold">
              Link a file (auto-save){" "}
              <span className="font-normal text-muted-foreground">
                — PC Chrome / Edge
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Pick a file once, ideally inside your Google Drive (or iCloud /
              Dropbox) folder. The app then auto-saves to it and your existing
              drive app syncs it to every device.
            </p>
          </div>

          {!sync.linkSupported ? (
            <p className="text-sm text-muted-foreground">
              This browser does not support file linking. Use Export / Import
              above instead.
            </p>
          ) : sync.linked ? (
            <div className="space-y-3">
              <p className="text-sm">
                Linked to <strong>{sync.fileName}</strong>
                {sync.needsPermission && (
                  <span className="text-destructive">
                    {" "}
                    — permission needed
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {sync.needsPermission ? (
                  <Button onClick={sync.reconnect} disabled={busy}>
                    <Link2 className="h-4 w-4" /> Reconnect file
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={sync.saveToFile} disabled={busy}>
                      <Save className="h-4 w-4" /> Save now
                    </Button>
                    <Button variant="secondary" onClick={sync.loadFromFile} disabled={busy}>
                      <FolderSync className="h-4 w-4" /> Load now
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={sync.unlink} disabled={busy}>
                  <Link2Off className="h-4 w-4" /> Unlink
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={sync.autoSave}
                  onChange={(event) => sync.setAutoSave(event.target.checked)}
                />
                Auto-save to this file whenever my data changes
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={sync.linkNewFile} disabled={busy}>
                <Link2 className="h-4 w-4" /> Create new file
              </Button>
              <Button variant="secondary" onClick={sync.linkExistingFile} disabled={busy}>
                <Link2 className="h-4 w-4" /> Link existing file
              </Button>
            </div>
          )}
        </div>

        {sync.message && <p className={`text-sm ${statusColor}`}>{sync.message}</p>}
      </CardContent>
    </Card>
  );
}
