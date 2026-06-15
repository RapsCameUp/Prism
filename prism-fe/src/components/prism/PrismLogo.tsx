import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrismLogo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <motion.div
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary/90 to-primary/40 glow-green"
      >
        <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
        <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary text-glow-green animate-pulse" />
      </motion.div>
      {withText && (
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-tight text-foreground">PRISM</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            ops.ai
          </span>
        </div>
      )}
    </div>
  );
}
