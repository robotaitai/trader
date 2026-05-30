"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  PieChart,
  Radar,
  RefreshCcw,
  Settings2,
  Table2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Holdings", href: "/holdings", icon: Table2 },
  { label: "Performance Lab", href: "/performance-lab", icon: FlaskConical },
  { label: "Exposure Map", href: "/exposure-map", icon: Radar },
  { label: "Sectors", href: "/sectors", icon: PieChart },
  { label: "Investor Mirror", href: "#", icon: BarChart3, disabled: true },
  { label: "Decision Journal", href: "#", icon: ClipboardList, disabled: true },
  { label: "AI Coach", href: "#", icon: Brain, disabled: true },
  { label: "Sync Settings", href: "/sync-settings", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-white/92 backdrop-blur md:block">
        <div className="flex h-full flex-col">
          <div className="border-b px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                <RefreshCcw className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">Investor OS</div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Private cockpit
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const content = (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active && "bg-black text-white",
                    !active && !item.disabled && "text-gray-700 hover:bg-gray-100",
                    item.disabled && "cursor-not-allowed text-gray-400",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.disabled ? (
                    <Badge variant="outline" className="border-gray-200 text-[10px] text-gray-400">
                      Soon
                    </Badge>
                  ) : null}
                </div>
              );

              return item.disabled ? (
                <div key={item.label} aria-disabled="true">
                  {content}
                </div>
              ) : (
                <Link key={item.label} href={item.href}>
                  {content}
                </Link>
              );
            })}
          </nav>

          <div className="border-t px-6 py-5 text-xs leading-5 text-muted-foreground">
            Local-first Phase 1. Data stays in this browser via localStorage.
          </div>
        </div>
      </aside>

      <main className="min-h-screen md:pl-72">
        <div className="border-b bg-white/85 px-5 py-4 backdrop-blur md:hidden">
          <div className="text-lg font-semibold">Investor OS</div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navigation
              .filter((item) => !item.disabled)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-md border px-3 py-1.5 text-sm",
                    pathname === item.href && "bg-black text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
