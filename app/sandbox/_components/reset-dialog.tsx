"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export function ResetDialog({
  open,
  busy,
  note,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  note: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="bg-card text-foreground m-auto w-[min(26rem,calc(100%-2rem))] rounded-lg border p-5 shadow-xl backdrop:bg-black/40"
    >
      <h2 className="mb-2 text-sm font-bold">Reset demo data?</h2>
      <p className="text-muted-foreground mb-1">
        This deletes every row in the database, including users and sessions,
        then seeds the Sandbox school again.
      </p>
      {note ? <p className="text-muted-foreground mb-1">{note}</p> : null}
      <p className="text-muted-foreground mb-4">
        You will be signed back in as the current persona.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={busy} onClick={onConfirm}>
          {busy ? "Resetting…" : "Reset and re-seed"}
        </Button>
      </div>
    </dialog>
  );
}
