"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Loader2 } from "lucide-react";
import { updateProfile } from "@/lib/auth/actions";

interface ProfileFormProps {
  fullName: string | null;
  email: string;
}

export function ProfileForm({ fullName, email }: ProfileFormProps) {
  return (
    <div className="panel p-6 space-y-4">
      <h2 className="heading-md">Profile</h2>
      <div className="space-y-3">
        <EditableRow
          label="Name"
          initialValue={fullName ?? ""}
          fieldName="fullName"
          onSave={async (value) => {
            const fd = new FormData();
            fd.set("fullName", value);
            return updateProfile(fd);
          }}
        />
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <p className="mt-1 text-sm">{email}</p>
        </div>
      </div>
    </div>
  );
}

function EditableRow({
  label,
  initialValue,
  fieldName,
  onSave,
}: {
  label: string;
  initialValue: string;
  fieldName: string;
  onSave: (value: string) => Promise<{ error?: string; success?: boolean }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    if (!value.trim()) {
      setError(`${label} cannot be empty`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSave(value.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setValue(initialValue);
    setError(null);
    setEditing(false);
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              name={fieldName}
              type="text"
              className="input-field flex-1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg p-2 text-primary hover:bg-primary/10 transition-colors"
              title="Save"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2 group">
          <p className="text-sm">{initialValue || "—"}</p>
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all"
            title={`Edit ${label.toLowerCase()}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
