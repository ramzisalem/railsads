"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  EyeOff,
  Folder,
  FolderPlus,
  LayoutTemplate,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateFolder, TemplateOption } from "@/lib/studio/types";
import { TemplateUploadDialog } from "./template-upload-dialog";
import { TemplatePreviewDialog } from "./template-preview-dialog";

const ACTION_MENU_W = 200;
const FOLDER_MENU_H_ESTIMATE = 260;

// Sentinel selection value for the "All folders" view — distinct from any
// real UUID so we can store it in the same state as a real folder id.
const ALL_KEY = "__all";

type TileMenuState = {
  template: TemplateOption;
  top: number;
  left: number;
};

type FolderActionMenuState = {
  folder: TemplateFolder;
  /** Bounding rect of the trigger (the trash icon) in viewport coords.
   *  The menu uses this to anchor itself and will clamp to the viewport
   *  on mount. */
  anchor: DOMRect;
};

interface TemplateSectionProps {
  brandId: string;
  templates: TemplateOption[];
  folders: TemplateFolder[];
  /** Ordered set of template ids currently selected for the thread. */
  selectedIds: string[];
  disabled?: boolean;
  /** Called when the user toggles a template's selection. */
  onToggle: (template: TemplateOption) => void;
  /** Optional side-effect hook for when a selected template has been
   *  removed from the library (deleted or hidden). Parent should drop
   *  its id from `selectedIds`. */
  onSelectedTemplateRemoved?: (templateId: string) => void;
}

/**
 * The templates picker inside the Studio context panel.
 *
 * Simple invariant: every template belongs to exactly one folder. The
 * dropdown at the top filters which folder's templates are shown; "All
 * folders" shows every template in a single flat grid with no internal
 * section headers (the user asked for no grouping inside the picker).
 *
 * Default folders are seeded once per brand from `templates.category`
 * (see `ensureTemplateFoldersSeeded`). They're treated as regular folders
 * from that point on — the user can rename, delete, or add their own
 * alongside them. Deleting a folder that has templates forces a
 * reassignment via the picker (the server refuses otherwise).
 */
export function TemplateSection({
  brandId,
  templates,
  folders,
  selectedIds,
  disabled,
  onToggle,
  onSelectedTemplateRemoved,
}: TemplateSectionProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const [selectedFolderKey, setSelectedFolderKey] = useState<string>(ALL_KEY);
  const [showUpload, setShowUpload] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateOption | null>(
    null
  );
  const [tileMenu, setTileMenu] = useState<TileMenuState | null>(null);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Delete folder" action menu — viewport-anchored popover shown when
  // the user clicks the trash icon on a folder row. Offers Move vs Delete
  // without forcing a full modal.
  const [folderActionMenu, setFolderActionMenu] =
    useState<FolderActionMenuState | null>(null);

  const templatesByFolder = useMemo(() => {
    const map = new Map<string, TemplateOption[]>();
    for (const t of templates) {
      const key = t.folder_id ?? "";
      if (!key) continue; // every template should have a folder; skip stragglers
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [templates]);

  // Folder the upload dialog pre-selects. If the user is filtered to a
  // specific folder, start there; otherwise fall back to the first
  // folder so the picker always has a valid choice.
  const uploadDefaultFolderId = useMemo(() => {
    if (selectedFolderKey !== ALL_KEY) return selectedFolderKey;
    return folders[0]?.id ?? null;
  }, [selectedFolderKey, folders]);

  const visibleTemplates = useMemo(() => {
    if (selectedFolderKey === ALL_KEY) return templates;
    return templatesByFolder.get(selectedFolderKey) ?? [];
  }, [templates, templatesByFolder, selectedFolderKey]);

  const selectedFolderLabel = useMemo(() => {
    if (selectedFolderKey === ALL_KEY) return "All folders";
    return (
      folders.find((f) => f.id === selectedFolderKey)?.name ?? "All folders"
    );
  }, [selectedFolderKey, folders]);

  useEffect(() => {
    if (!tileMenu) return;
    function close() {
      setTileMenu(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tileMenu]);

  const openTileMenu = useCallback(
    (template: TemplateOption, e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (tileMenu?.template.id === template.id) {
        setTileMenu(null);
        return;
      }
      const r = btn.getBoundingClientRect();
      let top = r.bottom + 4;
      if (top + FOLDER_MENU_H_ESTIMATE > window.innerHeight - 12) {
        top = Math.max(8, r.top - FOLDER_MENU_H_ESTIMATE - 4);
      }
      let left = r.right - ACTION_MENU_W;
      if (left < 8) left = 8;
      if (left + ACTION_MENU_W > window.innerWidth - 8) {
        left = window.innerWidth - ACTION_MENU_W - 8;
      }
      setTileMenu({ template, top, left });
    },
    [tileMenu]
  );

  async function createFolder(name: string): Promise<boolean> {
    setError(null);
    const res = await fetch("/api/studio/template-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, name }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      folder?: { id: string };
    };
    if (!res.ok) {
      setError(json.error || "Failed to create folder");
      return false;
    }
    startTransition(() => {
      router.refresh();
    });
    // Auto-select the fresh folder — most intents after "New folder" are
    // to immediately dump a template into it.
    if (json.folder?.id) setSelectedFolderKey(json.folder.id);
    return true;
  }

  async function renameFolder(
    folderId: string,
    name: string
  ): Promise<boolean> {
    setError(null);
    setBusyFolderId(folderId);
    try {
      const res = await fetch(`/api/studio/template-folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, name }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to rename folder");
        return false;
      }
      startTransition(() => {
        router.refresh();
      });
      return true;
    } finally {
      setBusyFolderId(null);
    }
  }

  /**
   * Open the folder action menu anchored to the trash icon the user
   * clicked. Coordinates come from the caller's `getBoundingClientRect`
   * and are clamped inside `FolderActionMenu` when it mounts.
   */
  function requestDeleteFolder(folder: TemplateFolder, anchor: DOMRect) {
    setError(null);
    setFolderActionMenu({ folder, anchor });
  }

  /**
   * Move every template out of `folder` into `targetId`, then delete
   * the (now-empty) folder. Single server round-trip via `?moveTo`.
   */
  async function moveThenDeleteFolder(
    folder: TemplateFolder,
    targetId: string
  ) {
    setError(null);
    setBusyFolderId(folder.id);
    setFolderActionMenu(null);
    try {
      const params = new URLSearchParams({ brandId, moveTo: targetId });
      const res = await fetch(
        `/api/studio/template-folders/${folder.id}?${params.toString()}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to move templates");
        return;
      }
      if (selectedFolderKey === folder.id) setSelectedFolderKey(targetId);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusyFolderId(null);
    }
  }

  /**
   * Cascade-delete the folder: drops the folder row AND destroys every
   * template inside it (hard delete for brand uploads, hide for system
   * templates). Destructive; clears any selections referencing the
   * doomed templates so the thread's `template_ids` doesn't end up
   * pointing at ghosts.
   */
  async function cascadeDeleteFolder(folder: TemplateFolder) {
    setError(null);
    setBusyFolderId(folder.id);
    setFolderActionMenu(null);
    try {
      const res = await fetch(
        `/api/studio/template-folders/${folder.id}?brandId=${encodeURIComponent(brandId)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to delete folder");
        return;
      }

      const doomed = templatesByFolder.get(folder.id) ?? [];
      for (const t of doomed) {
        if (selectedSet.has(t.id)) {
          onSelectedTemplateRemoved?.(t.id);
        }
      }

      if (selectedFolderKey === folder.id) setSelectedFolderKey(ALL_KEY);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusyFolderId(null);
    }
  }

  async function moveTemplate(template: TemplateOption, folderId: string) {
    if ((template.folder_id ?? null) === folderId) return;
    setError(null);
    setBusyTemplateId(template.id);
    setTileMenu(null);
    try {
      const res = await fetch(`/api/studio/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, folder_id: folderId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to move template");
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function removeTemplate(template: TemplateOption) {
    const isSystem = template.is_system;
    const message = isSystem
      ? `Remove "${template.name}" from your templates? You can restore system templates later by contacting support.`
      : `Delete the "${template.name}" template? This can't be undone.`;
    if (!window.confirm(message)) return;

    setError(null);
    setBusyTemplateId(template.id);
    setTileMenu(null);
    try {
      const res = await fetch(
        `/api/studio/templates/${template.id}?brandId=${encodeURIComponent(brandId)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Failed to remove template");
        return;
      }
      if (selectedSet.has(template.id)) {
        onSelectedTemplateRemoved?.(template.id);
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusyTemplateId(null);
    }
  }

  function renderTile(template: TemplateOption) {
    const selected = selectedSet.has(template.id);
    return (
      <TemplateTile
        key={template.id}
        template={template}
        selected={selected}
        selectionIndex={selected ? selectedIds.indexOf(template.id) : -1}
        disabled={disabled || busyTemplateId === template.id}
        busy={busyTemplateId === template.id}
        menuOpen={tileMenu?.template.id === template.id}
        onSelect={() => onToggle(template)}
        onPreview={() => setPreviewTemplate(template)}
        onMenu={(e) => openTileMenu(template, e)}
      />
    );
  }

  const hasFolders = folders.length > 0;

  return (
    <div className="space-y-3.5">
      <FolderDropdown
        selectedKey={selectedFolderKey}
        selectedLabel={selectedFolderLabel}
        allCount={templates.length}
        folders={folders.map((folder) => ({
          folder,
          count: templatesByFolder.get(folder.id)?.length ?? 0,
        }))}
        busyFolderId={busyFolderId}
        disabled={disabled}
        onSelect={setSelectedFolderKey}
        onCreate={createFolder}
        onRename={renameFolder}
        onRequestDelete={requestDeleteFolder}
      />

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {hasFolders ? (
        <div className="grid grid-cols-2 gap-2.5">
          <AddTemplateTile
            onClick={() => setShowUpload(true)}
            disabled={disabled}
          />
          {visibleTemplates.map((t) => renderTile(t))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-3 py-5 text-center text-xs text-muted-foreground">
          Create a folder first to start adding templates.
        </div>
      )}

      {showUpload && hasFolders && (
        <TemplateUploadDialog
          brandId={brandId}
          folders={folders}
          initialFolderId={uploadDefaultFolderId}
          onClose={() => setShowUpload(false)}
          onCreated={(template) => {
            setShowUpload(false);
            // Auto-add the fresh upload to the selection — the user put
            // effort into this, so the obvious next intent is to generate
            // with it alongside whatever else is already picked.
            if (!selectedSet.has(template.id)) {
              onToggle(template);
            }
            // Also snap the folder filter to where they just dropped it
            // so they can confirm placement at a glance.
            if (template.folder_id) {
              setSelectedFolderKey(template.folder_id);
            }
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {tileMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <TileMenu
            template={tileMenu.template}
            folders={folders}
            top={tileMenu.top}
            left={tileMenu.left}
            onClose={() => setTileMenu(null)}
            onMove={(folderId) => moveTemplate(tileMenu.template, folderId)}
            onRemove={() => removeTemplate(tileMenu.template)}
          />,
          document.body
        )}

      {folderActionMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <FolderActionMenu
            folder={folderActionMenu.folder}
            anchor={folderActionMenu.anchor}
            otherFolders={folders.filter(
              (f) => f.id !== folderActionMenu.folder.id
            )}
            templatesInFolder={
              templatesByFolder.get(folderActionMenu.folder.id)?.length ?? 0
            }
            submitting={busyFolderId === folderActionMenu.folder.id}
            onClose={() => setFolderActionMenu(null)}
            onMove={(targetId) =>
              moveThenDeleteFolder(folderActionMenu.folder, targetId)
            }
            onDelete={() => cascadeDeleteFolder(folderActionMenu.folder)}
          />,
          document.body
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder dropdown
// ---------------------------------------------------------------------------

interface FolderDropdownProps {
  selectedKey: string;
  selectedLabel: string;
  allCount: number;
  folders: Array<{ folder: TemplateFolder; count: number }>;
  busyFolderId: string | null;
  disabled?: boolean;
  onSelect: (key: string) => void;
  onCreate: (name: string) => Promise<boolean>;
  onRename: (folderId: string, name: string) => Promise<boolean>;
  onRequestDelete: (folder: TemplateFolder, anchor: DOMRect) => void;
}

function FolderDropdown({
  selectedKey,
  selectedLabel,
  allCount,
  folders,
  busyFolderId,
  disabled,
  onSelect,
  onCreate,
  onRename,
  onRequestDelete,
}: FolderDropdownProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: globalThis.MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSelect(key: string) {
    onSelect(key);
    setOpen(false);
    setCreating(false);
    setRenamingId(null);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName("");
      return;
    }
    const ok = await onCreate(name);
    if (ok) {
      setCreating(false);
      setNewName("");
      setOpen(false);
    }
  }

  async function handleRename(folderId: string) {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    const ok = await onRename(folderId, name);
    if (ok) setRenamingId(null);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition-colors",
          "hover:border-primary/40 hover:bg-primary-soft/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-panel"
        >
          <DropdownRow
            label="All folders"
            count={allCount}
            active={selectedKey === ALL_KEY}
            onClick={() => handleSelect(ALL_KEY)}
          />

          {folders.map(({ folder, count }) => {
            const isRenaming = renamingId === folder.id;
            if (isRenaming) {
              return (
                <div key={folder.id} className="px-1.5 py-1">
                  <FolderNameInput
                    value={renameValue}
                    onChange={setRenameValue}
                    onCommit={() => handleRename(folder.id)}
                    onCancel={() => setRenamingId(null)}
                    placeholder="Folder name"
                    submitting={busyFolderId === folder.id}
                  />
                </div>
              );
            }
            const isActive = selectedKey === folder.id;
            return (
              <div
                key={folder.id}
                className={cn(
                  "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isActive ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-left">
                    {folder.name}
                  </span>
                  {/*
                    Fixed-width slot on the right so the count column
                    aligns vertically across every row. On hover the count
                    is swapped out for the edit/delete controls — the slot
                    width stays constant, so the label doesn't shift.
                  */}
                  <RowActionsSlot>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums transition-opacity group-hover:opacity-0",
                        isActive ? "text-primary/80" : "text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </RowActionsSlot>
                </button>

                {/*
                  Absolutely-positioned so the inline button above keeps
                  its clickable area; the actions overlay the count slot
                  on hover only. `pointer-events-none` when hidden so the
                  underlying row stays fully clickable.
                */}
                <div
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5 opacity-0 transition-opacity",
                    "group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(folder.id);
                      setRenameValue(folder.name);
                    }}
                    aria-label={`Rename ${folder.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setOpen(false);
                      onRequestDelete(folder, rect);
                    }}
                    disabled={busyFolderId === folder.id}
                    aria-label={`More actions for ${folder.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {creating && (
            <div className="px-1.5 py-1">
              <FolderNameInput
                value={newName}
                onChange={setNewName}
                onCommit={handleCreate}
                onCancel={() => {
                  setCreating(false);
                  setNewName("");
                }}
                placeholder="Folder name"
              />
            </div>
          )}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCreating(true);
              setNewName("");
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary transition-colors hover:bg-primary-soft/70"
          >
            <FolderPlus className="h-4 w-4" />
            New folder
          </button>
        </div>
      )}
    </div>
  );
}

function DropdownRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-foreground hover:bg-muted"
      )}
    >
      {active ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <RowActionsSlot>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            active ? "text-primary/80" : "text-muted-foreground"
          )}
        >
          {count}
        </span>
      </RowActionsSlot>
    </button>
  );
}

/**
 * Fixed-width right-edge slot shared by every dropdown row. Keeping the
 * slot width constant (regardless of whether it holds a 1-char count, a
 * 3-char count, or the pair of edit/delete icons) is what makes the count
 * column line up vertically across every folder row.
 */
function RowActionsSlot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-12 shrink-0 items-center justify-end">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Folder action menu (Move vs Delete) shown on trash-icon click.
// ---------------------------------------------------------------------------

const FOLDER_ACTION_MENU_W = 240;
const FOLDER_ACTION_SUBMENU_W = 220;
const FOLDER_ACTION_MENU_GAP = 6;

/**
 * Anchored popover with two top-level choices for the folder whose
 * delete icon was clicked:
 *
 *   - Move templates to… → expands into a side submenu listing every
 *     other folder. Picking one reassigns the templates and drops the
 *     now-empty folder (non-destructive, no template loss).
 *   - Delete folder        → destructive cascade. We don't chain an
 *     extra `window.confirm` — the menu item itself is the deliberate
 *     choice, and the label spells out the consequence.
 *
 * Positioning is viewport-clamped. The submenu prefers to open to the
 * right of the root panel and flips left if it would overflow.
 */
function FolderActionMenu({
  folder,
  anchor,
  otherFolders,
  templatesInFolder,
  submitting,
  onClose,
  onMove,
  onDelete,
}: {
  folder: TemplateFolder;
  anchor: DOMRect;
  otherFolders: TemplateFolder[];
  templatesInFolder: number;
  submitting: boolean;
  onClose: () => void;
  onMove: (targetId: string) => void;
  onDelete: () => void;
}) {
  const [step, setStep] = useState<"root" | "move">("root");
  const panelRef = useRef<HTMLDivElement>(null);
  const hasTemplates = templatesInFolder > 0;
  const canMove = hasTemplates && otherFolders.length > 0;

  // Close on outside click / escape / scroll. Scroll listener is capture
  // phase so it catches every scrollable ancestor, not just the window.
  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      const target = e.target as Node | null;
      if (!target || panelRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScrollOrResize() {
      onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [onClose]);

  // Root panel: right-align to the trash icon, drop below by default
  // and flip up if we'd overflow the bottom of the viewport.
  const rootPosition = useMemo(() => {
    const rootHeightEstimate = canMove ? 92 : 48;
    let top = anchor.bottom + 4;
    if (top + rootHeightEstimate > window.innerHeight - 12) {
      top = Math.max(8, anchor.top - rootHeightEstimate - 4);
    }
    let left = anchor.right - FOLDER_ACTION_MENU_W;
    if (left < 8) left = 8;
    if (left + FOLDER_ACTION_MENU_W > window.innerWidth - 8) {
      left = window.innerWidth - FOLDER_ACTION_MENU_W - 8;
    }
    return { top, left };
  }, [anchor, canMove]);

  // Submenu: prefer to the right of the root panel, flip to the left
  // when it would clip. Vertically aligns with the root.
  const submenuPosition = useMemo(() => {
    const rootRight = rootPosition.left + FOLDER_ACTION_MENU_W;
    const roomRight = window.innerWidth - 8 - rootRight;
    let left: number;
    if (roomRight >= FOLDER_ACTION_SUBMENU_W + FOLDER_ACTION_MENU_GAP) {
      left = rootRight + FOLDER_ACTION_MENU_GAP;
    } else {
      left = Math.max(
        8,
        rootPosition.left - FOLDER_ACTION_SUBMENU_W - FOLDER_ACTION_MENU_GAP
      );
    }
    const submenuHeightEstimate = Math.min(
      320,
      Math.max(80, otherFolders.length * 36 + 40)
    );
    let top = rootPosition.top;
    if (top + submenuHeightEstimate > window.innerHeight - 12) {
      top = Math.max(8, window.innerHeight - 12 - submenuHeightEstimate);
    }
    return { top, left };
  }, [rootPosition, otherFolders.length]);

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${folder.name}`}
      className="fixed z-[70]"
      style={{ top: rootPosition.top, left: rootPosition.left }}
    >
      <div
        className="overflow-hidden rounded-lg border border-border bg-card p-1 shadow-panel"
        style={{ width: FOLDER_ACTION_MENU_W }}
      >
        {canMove && (
          <button
            type="button"
            role="menuitem"
            disabled={submitting}
            onMouseEnter={() => setStep("move")}
            onFocus={() => setStep("move")}
            onClick={() => setStep("move")}
            aria-haspopup="menu"
            aria-expanded={step === "move"}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors",
              step === "move" ? "bg-muted" : "hover:bg-muted",
              "disabled:opacity-50"
            )}
          >
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              Move templates to…
            </span>
            <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          disabled={submitting}
          onMouseEnter={() => setStep("root")}
          onClick={onDelete}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors",
            "hover:bg-destructive/10 disabled:opacity-50"
          )}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {hasTemplates ? "Delete folder & templates" : "Delete folder"}
          </span>
        </button>
      </div>

      {step === "move" && canMove && (
        <div
          className="fixed max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-panel"
          style={{
            top: submenuPosition.top,
            left: submenuPosition.left,
            width: FOLDER_ACTION_SUBMENU_W,
          }}
        >
          <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Move templates to
          </div>
          {otherFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              disabled={submitting}
              onClick={() => onMove(f.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared small UI (name input, tiles, tile menu)
// ---------------------------------------------------------------------------

function FolderNameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  submitting,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  submitting?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        maxLength={60}
        disabled={submitting}
        className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/60"
      />
      <button
        type="button"
        onClick={onCommit}
        disabled={submitting}
        className="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        aria-label="Cancel"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddTemplateTile({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors",
        "hover:border-primary/40 hover:bg-primary-soft/20 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "disabled:pointer-events-none disabled:opacity-60"
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-soft text-foreground transition-colors group-hover:bg-primary-soft group-hover:text-primary">
        <Plus className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide">
        Add template
      </span>
    </button>
  );
}

function TemplateTile({
  template,
  selected,
  selectionIndex,
  disabled,
  busy,
  menuOpen,
  onSelect,
  onPreview,
  onMenu,
}: {
  template: TemplateOption;
  selected: boolean;
  /** Position in the multi-select (0-based). -1 when not selected. Shown
   *  as a numeric badge so users can tell the fan-out order apart when
   *  multiple templates are queued. */
  selectionIndex: number;
  disabled?: boolean;
  busy?: boolean;
  menuOpen?: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onMenu: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-xl border bg-card transition-all",
        selected
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-border hover:border-primary/35",
        busy && "opacity-60"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={selected}
        title={template.name}
        className={cn(
          "block h-full w-full text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
        )}
      >
        <div className="relative h-full w-full bg-secondary-soft">
          {template.thumbnail_url ? (
            <Image
              src={template.thumbnail_url}
              alt={template.name}
              fill
              sizes="(max-width: 768px) 50vw, 200px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <LayoutTemplate className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/40 to-transparent px-2.5 pb-2 pt-6">
          <div className="line-clamp-1 text-[11px] font-semibold text-background">
            {template.name}
          </div>
          {!template.is_system && (
            <div className="mt-0.5 inline-flex items-center rounded-full bg-background/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-background">
              Custom
            </div>
          )}
        </div>
        {selected && (
          // Selection badge sits in the same top-right slot as the
          // 3-dots menu button. On hover (or while the menu is open) we
          // fade the badge out so the action button can take its place
          // without the two visually stacking.
          <span
            className={cn(
              "absolute right-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm transition-opacity",
              menuOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0"
            )}
          >
            {selectionIndex >= 0 ? (
              selectionIndex + 1
            ) : (
              <Check className="h-3 w-3" />
            )}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        aria-label={`Preview ${template.name}`}
        title="Preview"
        className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Maximize2 className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={onMenu}
        disabled={disabled}
        aria-label={`Options for ${template.name}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className={cn(
          "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background transition-opacity hover:bg-foreground disabled:pointer-events-none",
          menuOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        )}
        data-open={menuOpen}
      >
        <MoreHorizontal className="h-3 w-3" />
      </button>
    </div>
  );
}

function TileMenu({
  template,
  folders,
  top,
  left,
  onClose,
  onMove,
  onRemove,
}: {
  template: TemplateOption;
  folders: TemplateFolder[];
  top: number;
  left: number;
  onClose: () => void;
  onMove: (folderId: string) => void;
  onRemove: () => void;
}) {
  const currentFolder = template.folder_id ?? null;
  return (
    <>
      <div className="fixed inset-0 z-[100]" aria-hidden onClick={onClose} />
      <div
        role="menu"
        className="fixed z-[110] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-panel"
        style={{ top, left, width: ACTION_MENU_W }}
      >
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Move to folder
        </div>
        {folders.map((folder) => (
          <MoveItem
            key={folder.id}
            label={folder.name}
            active={currentFolder === folder.id}
            onClick={() => onMove(folder.id)}
          />
        ))}

        <div className="my-1 h-px bg-border" />

        <button
          type="button"
          role="menuitem"
          onClick={onRemove}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          {template.is_system ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {template.is_system ? "Remove from library" : "Delete template"}
        </button>
      </div>
    </>
  );
}

function MoveItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-foreground hover:bg-muted"
      )}
    >
      {active ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <span className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="truncate text-left">{label}</span>
    </button>
  );
}
