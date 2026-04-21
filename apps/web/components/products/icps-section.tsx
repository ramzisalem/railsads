"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { IcpCard } from "./icp-card";
import { IcpForm } from "./icp-form";
import type { IcpItem } from "@/lib/products/queries";

interface IcpsSectionProps {
  brandId: string;
  productId: string;
  icps: IcpItem[];
}

export function IcpsSection({ brandId, productId, icps }: IcpsSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingIcp, setEditingIcp] = useState<IcpItem | null>(null);

  function openCreate() {
    setEditingIcp(null);
    setFormOpen(true);
  }

  function openEdit(icp: IcpItem) {
    setEditingIcp(icp);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingIcp(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="heading-md">Audiences</h2>
          <p className="mt-1 text-small text-muted-foreground">
            {icps.length === 0
              ? "Define who buys this product so the AI can speak to them."
              : `${icps.length} audience${icps.length === 1 ? "" : "s"} described — used to brief every ad.`}
          </p>
        </div>
        {icps.length > 0 && (
          <button
            onClick={openCreate}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add audience
          </button>
        )}
      </div>

      {icps.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary-soft/40 p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No audiences yet
          </p>
          <p className="mt-1 max-w-sm text-small text-muted-foreground">
            Add one manually or generate them from your brand context to give
            the AI a target.
          </p>
          <button onClick={openCreate} className="btn-primary mt-4 gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add first audience
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {icps.map((icp) => (
            <IcpCard key={icp.id} icp={icp} onEdit={openEdit} />
          ))}
        </div>
      )}

      {formOpen && (
        <IcpForm
          brandId={brandId}
          productId={productId}
          icp={editingIcp}
          onClose={closeForm}
        />
      )}
    </section>
  );
}
