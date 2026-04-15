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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">Ideal Customer Profiles</h2>
        <button
          onClick={openCreate}
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add ICP
        </button>
      </div>

      {icps.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed p-6">
          <div className="text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground opacity-60" />
            <p className="mt-3 text-small text-muted-foreground">
              No ICPs yet. Add one manually or generate with AI.
            </p>
            <button onClick={openCreate} className="btn-primary mt-3 text-xs">
              Add first ICP
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
    </div>
  );
}
