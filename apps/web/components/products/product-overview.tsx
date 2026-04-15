"use client";

import { useState, useTransition } from "react";
import { InlineField } from "@/components/brand/inline-field";
import { TagEditor } from "@/components/brand/tag-editor";
import { updateProduct, deleteProduct } from "@/lib/products/actions";
import type { ProductDetail } from "@/lib/products/queries";
import { ExternalLink, Trash2 } from "lucide-react";

interface ProductOverviewProps {
  product: ProductDetail;
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ProductOverview({ product }: ProductOverviewProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const benefits = (product.attributes as { benefits?: string[] })?.benefits ?? [];

  function handleDelete() {
    startTransition(async () => {
      await deleteProduct(product.id);
    });
  }

  return (
    <div className="panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">Overview</h2>
        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View product
          </a>
        )}
      </div>

      <div className="space-y-4">
        <InlineField
          label="Product name"
          value={product.name}
          onSave={async (name) => updateProduct(product.id, { name })}
        />

        <InlineField
          label="Short description"
          value={product.short_description}
          placeholder="One-line product summary"
          onSave={async (v) =>
            updateProduct(product.id, { short_description: v || null })
          }
        />

        <InlineField
          label="Description"
          value={product.description}
          placeholder="Detailed product description"
          multiline
          onSave={async (v) =>
            updateProduct(product.id, { description: v || null })
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Price</div>
            {product.price_amount !== null && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {formatPrice(product.price_amount, product.price_currency)}
              </div>
            )}
            <InlineField
              label=""
              value={
                product.price_amount !== null
                  ? String(product.price_amount)
                  : null
              }
              placeholder="e.g., 29.99"
              onSave={async (v) => {
                const num = parseFloat(v);
                return updateProduct(product.id, {
                  price_amount: isNaN(num) ? null : num,
                });
              }}
            />
          </div>

          <InlineField
            label="Product URL"
            value={product.product_url}
            placeholder="https://..."
            onSave={async (v) =>
              updateProduct(product.id, { product_url: v || null })
            }
          />
        </div>

        <TagEditor
          label="Key benefits"
          tags={benefits}
          onSave={async (tags) =>
            updateProduct(product.id, {
              attributes: { ...product.attributes, benefits: tags },
            })
          }
        />
      </div>

      <div className="border-t pt-4">
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete product
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-destructive">
              Delete this product and all its ICPs?
            </span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              {isPending ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowDelete(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
