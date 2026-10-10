"use client";
import { ArrowRight, CircleCheck, CircleHelp, PackageX, Pill, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkStock } from "@/lib/pharmacy";
import { cn } from "@/lib/utils";
import type { RxItem } from "@/types/contracts";
import type { Substitute } from "@/types/features";

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

/** Hospital pharmacy check for each medicine; out-of-stock lines offer a same-generic, same-strength swap the doctor approves. */
export function StockPanel({ items, disabled, onSwap }: { items: RxItem[]; disabled?: boolean; onSwap: (index: number, sub: Substitute) => void }) {
  const checks = checkStock(items);
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-mute uppercase">
        <Pill className="size-4" /> Hospital pharmacy · mock stock
      </div>
      <ul className="divide-y">
        {checks.map((c) => {
          const it = items[c.index];
          const name = it.brand_match ?? it.drug_raw.value;
          const best = c.substitutes[0];
          const out = c.status === "out_of_stock";
          return (
            <li key={c.index} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5", out && "bg-amber-50 dark:bg-amber-950/40")}>
              <span className="min-w-40 font-medium">{name} <span className="text-sm text-muted-foreground">{it.strength.value}</span></span>
              {c.status === "in_stock" && <span className="flex items-center gap-1 text-sm text-scrub"><CircleCheck className="size-4" /> In stock{c.entry && ` · ${rs(c.entry.unitPrice)}/tab`}</span>}
              {out && <span className="flex items-center gap-1 text-sm font-semibold text-amber-800 dark:text-amber-300"><PackageX className="size-4" /> Out of stock</span>}
              {(c.status === "not_stocked" || c.status === "unknown") && <span className="flex items-center gap-1 text-sm text-muted-foreground"><CircleHelp className="size-4" /> Not on hospital list — patient buys outside</span>}
              {out && best && (
                <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span>{best.brand.toLowerCase().includes(best.generic) ? <b>{best.brand}</b> : <><b className="capitalize">{best.generic}</b> ({best.brand})</>} in stock · {rs(best.unitPrice)}/tab</span>
                  {best.savesPerCourse !== undefined && best.savesPerCourse > 0 && (
                    <span className="rounded-[3px] bg-scrub-tint px-1.5 py-0.5 font-mono text-xs font-semibold text-scrub">saves {rs(best.savesPerCourse)}</span>
                  )}
                  <Button size="sm" disabled={disabled} onClick={() => onSwap(c.index, best)} className="h-8 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
                    <Repeat className="size-4" /> Swap
                  </Button>
                </span>
              )}
              {out && !best && <span className="ml-auto text-sm text-muted-foreground">No same-strength substitute in stock</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
