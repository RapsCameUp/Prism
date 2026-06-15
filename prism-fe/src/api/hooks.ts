import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

// ─── Repositories ────────────────────────────────────────────

export function useRepositories() {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepositories(),
  });
}

export function useRepository(id: string) {
  return useQuery({
    queryKey: ["repositories", id],
    queryFn: () => api.getRepository(id),
    enabled: !!id,
  });
}

export function useCreateRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; serviceName: string; githubUrl: string; defaultBranch?: string; environment?: string }) =>
      api.createRepository(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

export function useUpdateRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; serviceName: string; githubUrl: string; defaultBranch: string; environment: string; isActive: boolean }> }) =>
      api.updateRepository(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

export function useDeleteRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRepository(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

// ─── Incidents ───────────────────────────────────────────────

export function useIncidents() {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.getIncidents(),
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ["incidents", id],
    queryFn: () => api.getIncident(id),
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description: string; severity: string; serviceName: string }) =>
      api.createIncident(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; description: string; severity: string; status: string }> }) =>
      api.updateIncident(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

// ─── Investigations ──────────────────────────────────────────

export function useInvestigation(incidentId: string) {
  return useQuery({
    queryKey: ["investigations", incidentId],
    queryFn: () => api.getInvestigation(incidentId),
    enabled: !!incidentId,
    retry: false,
  });
}

export function useStartInvestigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) => api.startInvestigation(incidentId),
    onSuccess: (_data, incidentId) => {
      qc.invalidateQueries({ queryKey: ["investigations", incidentId] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

// ─── Remediations ────────────────────────────────────────────

export function useGenerateRemediation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) => api.generateRemediation(incidentId),
    onSuccess: (_data, incidentId) => {
      qc.invalidateQueries({ queryKey: ["incidents", incidentId] });
    },
  });
}

export function useCreateRemediationPR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) => api.createRemediationPR(incidentId),
    onSuccess: (_data, incidentId) => {
      qc.invalidateQueries({ queryKey: ["incidents", incidentId] });
      qc.invalidateQueries({ queryKey: ["remediation", incidentId] });
    },
  });
}

// ─── Incident Logs ───────────────────────────────────────────

export function useIncidentLogs(incidentId: string) {
  return useQuery({
    queryKey: ["incident-logs", incidentId],
    queryFn: () => api.getIncidentLogs(incidentId),
    enabled: !!incidentId,
    retry: false,
  });
}

// ─── Incident Remediation Status ─────────────────────────────

export function useIncidentRemediation(incidentId: string) {
  return useQuery({
    queryKey: ["remediation", incidentId],
    queryFn: () => api.getIncidentRemediation(incidentId),
    enabled: !!incidentId,
    retry: false,
  });
}

// ─── Ask AI ──────────────────────────────────────────────────

export function useAskIncidentQuestion() {
  return useMutation({
    mutationFn: ({ incidentId, question }: { incidentId: string; question: string }) =>
      api.askIncidentQuestion(incidentId, question),
  });
}
