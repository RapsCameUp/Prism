import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, CheckCircle2, Loader2, ExternalLink, AlertCircle,
  Activity, GitBranch, Search, Shield, Cpu, Network
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useInvestigation } from "@/api/hooks";
import { cn } from "@/lib/utils";

interface InvestigationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentId: string;
  incidentTitle: string;
  onComplete?: () => void;
}

type AgentName = 'coordinator' | 'telemetry' | 'root-cause' | 'deployment' | 'pr-traceback' | 'remediation';
type AgentStatus = 'waiting' | 'running' | 'completed' | 'error';

interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const AGENT_CONFIG: Record<AgentName, { label: string; icon: React.ElementType; color: string }> = {
  coordinator: { label: 'Incident Coordinator', icon: Cpu, color: 'text-violet-400' },
  telemetry: { label: 'Telemetry Agent', icon: Activity, color: 'text-blue-400' },
  deployment: { label: 'Deployment Agent', icon: GitBranch, color: 'text-orange-400' },
  'root-cause': { label: 'Root Cause Agent', icon: Search, color: 'text-yellow-400' },
  'pr-traceback': { label: 'PR Traceback Agent', icon: Network, color: 'text-cyan-400' },
  remediation: { label: 'Remediation Agent', icon: Shield, color: 'text-green-400' },
};

export function InvestigationModal({ open, onOpenChange, incidentId, incidentTitle, onComplete }: InvestigationModalProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const { data: investigation, refetch } = useInvestigation(incidentId);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (open && !isDone && !isRunning && !investigation) {
      setIsRunning(true);
      setEvents([]);
      setError(null);
      setResult(null);

      // Get token from localStorage
      let token: string | null = null;
      try {
        const stored = localStorage.getItem("prism-auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.state?.token ?? null;
        }
      } catch { /* ignore */ }
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

      // Use EventSource for SSE streaming
      const url = `${baseUrl}/investigations/agent/${incidentId}/stream`;

      // EventSource doesn't support custom headers, so we use fetch with ReadableStream
      const abortController = new AbortController();

      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortController.signal,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Investigation failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.agent) {
                  setEvents(prev => [...prev, data as AgentEvent]);
                }
              } catch { /* skip invalid JSON */ }
            } else if (line.startsWith('event: complete')) {
              // Next data line will be the final result
            } else if (line.startsWith('event: error')) {
              // Next data line will have error info
            }
          }
        }

        // Stream ended
        setIsDone(true);
        setIsRunning(false);
        refetch();
        onComplete?.();
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setIsRunning(false);
        }
      });

      return () => {
        abortController.abort();
      };
    }
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEvents([]);
        setIsRunning(false);
        setIsDone(false);
        setError(null);
        setResult(null);
      }, 300);
    }
  }, [open]);

  // Derive agent statuses from events
  const agentStatuses = getAgentStatuses(events);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] flex flex-col">
        <DialogTitle className="flex items-center gap-2 text-base font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Multi-Agent Investigation
        </DialogTitle>

        <div className="mt-1 mb-2">
          <div className="text-sm text-muted-foreground">{incidentTitle}</div>
        </div>

        {error && (
          <div className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Agent Status Indicators */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(Object.keys(AGENT_CONFIG) as AgentName[]).map((agentName) => {
            const config = AGENT_CONFIG[agentName];
            const status = agentStatuses[agentName];
            const Icon = config.icon;
            return (
              <div
                key={agentName}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-all",
                  status === 'completed' && "border-primary/30 bg-primary/5",
                  status === 'running' && "border-primary/50 bg-primary/10 shadow-sm shadow-primary/20",
                  status === 'waiting' && "border-border bg-surface-2/20 opacity-50",
                  status === 'error' && "border-critical/30 bg-critical/5"
                )}
              >
                {status === 'running' && <Loader2 className={cn("h-3 w-3 animate-spin", config.color)} />}
                {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                {status === 'waiting' && <Icon className="h-3 w-3 text-muted-foreground" />}
                {status === 'error' && <AlertCircle className="h-3 w-3 text-critical" />}
                <span className={cn("font-medium truncate", status === 'running' && config.color)}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live Activity Feed */}
        <div
          ref={feedRef}
          className="flex-1 min-h-[250px] max-h-[350px] overflow-y-auto rounded-md border border-border bg-black/30 p-2 space-y-1 font-mono text-[11px]"
        >
          <AnimatePresence>
            {events.map((event, i) => {
              const config = AGENT_CONFIG[event.agent];
              const Icon = config.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2 py-0.5"
                >
                  <span className="text-muted-foreground/60 w-[52px] shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", config.color)} />
                  <span className={cn("shrink-0 font-semibold", config.color)}>
                    [{config.label}]
                  </span>
                  <span className={cn(
                    "text-foreground/80",
                    event.status === 'completed' && "text-primary",
                    event.status === 'error' && "text-critical"
                  )}>
                    {event.message}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {isRunning && events.length === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to investigation agents...
            </div>
          )}
        </div>

        {/* Results Summary */}
        {isDone && investigation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary">Investigation Complete</span>
              <span className="text-xs font-mono text-primary">{investigation.confidenceScore}% confidence</span>
            </div>
            <p className="text-xs text-foreground/80">{investigation.rootCause}</p>
            {investigation.suspectedPrUrl && (
              <a
                href={investigation.suspectedPrUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View suspected PR #{investigation.suspectedPrNumber} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </motion.div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          {isDone && (
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              View full report
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
            >
              {isRunning ? "Running in background" : "Close"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getAgentStatuses(events: AgentEvent[]): Record<AgentName, AgentStatus> {
  const statuses: Record<AgentName, AgentStatus> = {
    coordinator: 'waiting',
    telemetry: 'waiting',
    deployment: 'waiting',
    'root-cause': 'waiting',
    'pr-traceback': 'waiting',
    remediation: 'waiting',
  };

  for (const event of events) {
    if (event.status === 'completed') {
      statuses[event.agent] = 'completed';
    } else if (event.status === 'running' && statuses[event.agent] !== 'completed') {
      statuses[event.agent] = 'running';
    } else if (event.status === 'error') {
      statuses[event.agent] = 'error';
    }
  }

  return statuses;
}
