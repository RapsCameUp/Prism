import { Bell, Search, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

const envs = ["production · us-east-1", "production · eu-west-1", "staging", "dev"];

export function TopNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [env, setEnv] = useState(envs[0]);

  const initials = (user?.name ?? "AU")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4">
      {/* Env selector */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-surface-2/80 px-2.5 py-1.5 text-xs hover:bg-surface-2 transition-colors">
          <span className="status-dot bg-primary text-primary" />
          <span className="font-mono">{env}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="font-mono text-xs">
          {envs.map((e) => (
            <DropdownMenuItem key={e} onClick={() => setEnv(e)}>
              {e}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search incidents, services, PRs, traces…"
          className="w-full rounded-md border border-border bg-input/40 pl-8 pr-16 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {/* System health */}
      <div className="hidden lg:flex items-center gap-3 rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">CPU</span>
          <span className="text-primary">42%</span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">p99</span>
          <span className="text-warning">218ms</span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">err</span>
          <span className="text-critical">1.2%</span>
        </div>
      </div>

      {/* Notifications */}
      <button className="relative rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-critical" />
      </button>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md hover:bg-surface-2 px-1.5 py-1 transition-colors">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium">{user?.name}</span>
            <span className="text-[10px] text-muted-foreground">{user?.role}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
