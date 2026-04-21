import Link from "next/link";
import { Users, ExternalLink, Package } from "lucide-react";
import type { ProductListItem } from "@/lib/products/queries";

interface ProductCardProps {
  product: ProductListItem;
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="panel group flex flex-col gap-3 p-5 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary-soft">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.short_description && (
            <p className="mt-1 text-small text-muted-foreground line-clamp-2">
              {product.short_description}
            </p>
          )}
        </div>
        {product.price_amount !== null ? (
          <span className="shrink-0 text-sm font-medium">
            {formatPrice(product.price_amount, product.price_currency)}
          </span>
        ) : product.import_price_text ? (
          <span className="shrink-0 text-sm font-medium text-muted-foreground">
            {product.import_price_text}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {product.icp_count} ICP{product.icp_count !== 1 ? "s" : ""}
        </span>
        {product.product_url && (
          <span className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Link
          </span>
        )}
        {product.source === "website_import" && (
          <span className="tag text-[10px] py-0.5 px-2">Imported</span>
        )}
      </div>
    </Link>
  );
}
