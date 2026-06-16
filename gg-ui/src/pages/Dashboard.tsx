import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { buildCompanyUserProfileMap } from "../lib/company-members";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useTheme } from "../context/ThemeContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";

import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

const DASHBOARD_ACTIVITY_LIMIT = 10;

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { viewMode } = useTheme();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: [...queryKeys.activity(selectedCompanyId!), { limit: DASHBOARD_ACTIVITY_LIMIT }],
    queryFn: () => activityApi.list(selectedCompanyId!, { limit: DASHBOARD_ACTIVITY_LIMIT }),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(selectedCompanyId!),
    queryFn: () => accessApi.listUserDirectory(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const userProfileMap = useMemo(
    () => buildCompanyUserProfileMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  if (viewMode === "owner") {
    // Count stats dynamically from real API data
    const activeTasksCount = issues ? issues.filter(i => i.status === "in_progress" || i.status === "in_review").length : 3;
    const pendingApprovalsCount = data ? (data.pendingApprovals + data.budgets.pendingApprovals) : 2;
    const blockedTasksCount = issues ? issues.filter(i => i.status === "blocked" || i.blockerAttention).length : 1;

    return (
      <div className="space-y-6">
        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {hasNoAgents && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
            <div className="flex items-center gap-2.5">
              <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                You have no agents.
              </p>
            </div>
            <button
              onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
              className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
            >
              Create one here
            </button>
          </div>
        )}

        <section className="page active" id="o-overview">
          <div className="page-head">
            <div className="eyebrow">Owner Dashboard</div>
            <h1>Good afternoon, Ramsey</h1>
            <p>Here is what GIGI is working on right now. You should be able to read your whole operation in about 30 seconds.</p>
          </div>

          <div className="grid g4">
            <div className="card stat">
              <span className="label">Active strategic tasks</span>
              <span className="num">{activeTasksCount}</span>
              <span className="delta flat">1 launching this week</span>
            </div>
            <div className="card stat">
              <span className="label">Pending your approval</span>
              <span className="num" style={{ color: "var(--o-honey)" }}>{pendingApprovalsCount}</span>
              <span className="delta down">Waiting on you</span>
            </div>
            <div className="card stat">
              <span className="label">Blocked actions</span>
              <span className="num" style={{ color: "var(--o-red)" }}>{blockedTasksCount}</span>
              <span className="delta down">Needs the team</span>
            </div>
            <div className="card stat">
              <span className="label">Revenue impact (30d)</span>
              <span className="num">+$8,420</span>
              <span className="delta up">▲ 22% vs prior</span>
            </div>
          </div>

          <div className="grid g2" style={{ marginTop: "16px" }}>
            <div className="card">
              <h3>Marketing growth</h3>
              <p className="sub">Organic + published activity across all active tasks</p>
              <svg className="spark" viewBox="0 0 300 54" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1F6E43" stopOpacity={0.18}/>
                    <stop offset="1" stopColor="#1F6E43" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <path d="M0,42 L25,38 L50,40 L75,30 L100,33 L125,24 L150,27 L175,18 L200,21 L225,14 L250,12 L275,8 L300,6 L300,54 L0,54 Z" fill="url(#gg)"/>
                <polyline points="0,42 25,38 50,40 75,30 100,33 125,24 150,27 175,18 200,21 225,14 250,12 275,8 300,6" fill="none" stroke="#1F6E43" strokeWidth={2}/>
                <polyline points="0,50 25,49 50,48 75,46 100,47 125,44 150,45 175,41 200,42 225,39 250,38 275,35 300,33" fill="none" stroke="#E2982E" strokeWidth={2} strokeDasharray="0"/>
              </svg>
              <div className="legend">
                <span><i style={{ background: "var(--o-green)" }}></i>Sessions</span>
                <span><i style={{ background: "var(--o-honey)" }}></i>Conversions</span>
              </div>
              <div className="devnote">Source: GA4 property <b>503581327</b> · sessions & conversions, 30-day window. Owner view shows trend only — no event-level data.</div>
            </div>
            <div className="card">
              <h3>Next recommendation from GIGI</h3>
              <p className="sub">Generated by the CEO Agent from current results</p>
              <div className="rec go" style={{ border: "none", padding: 0, background: "none" }}>
                <div className="rank">1</div>
                <div>
                  <h4>Move Creatine Gummies to paid marketing</h4>
                  <p>Strongest organic signal across the 15-day test.</p>
                  <div className="why">Highest organic traffic (+34%), best add-to-cart rate (5.1%), and revenue per session 2.3× the other two products.</div>
                </div>
              </div>
              <Link to="/goals" className="btn btn-primary" style={{ marginTop: "14px", width: "auto", padding: "9px 18px", display: "inline-block", textAlign: "center" }}>
                Review all recommendations
              </Link>
            </div>
          </div>

          <h2 className="section-title">Your strategic tasks</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Current outcome</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {recentIssues.slice(0, 5).map((issue) => {
                let statusBadge = <span className="badge b-progress"><span className="d"></span>In progress</span>;
                let progress = 72;
                let nextAction = "View details →";

                if (issue.status === "done") {
                  statusBadge = <span className="badge b-live"><span className="d"></span>Live</span>;
                  progress = 100;
                  nextAction = "View report →";
                } else if (issue.status === "blocked" || issue.blockerAttention) {
                  statusBadge = <span className="badge b-blocked"><span className="d"></span>Blocked</span>;
                  progress = 88;
                  nextAction = "Resolve blocker →";
                }

                return (
                  <tr key={issue.id}>
                    <td>
                      <div className="t-name">
                        {issue.title}{" "}
                        <small>
                          <span className="tid">{issue.identifier ?? issue.id.slice(0, 8)}</span>
                        </small>
                      </div>
                    </td>
                    <td>{statusBadge}</td>
                    <td>
                      <div className="barwrap">
                        <div className="bar"><i style={{ width: `${progress}%` }}></i></div>
                        <span>{progress}%</span>
                      </div>
                    </td>
                    <td>{issue.description || "Analyzing and preparing draft"}</td>
                    <td>
                      <Link to={`/issues/${issue.identifier ?? issue.id}`} className="linklike" style={{ color: issue.status === "blocked" ? "var(--o-red)" : undefined }}>
                        {nextAction}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {recentIssues.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--muted-foreground)" }}>
                    No strategic tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="devnote">Parent rows = <b>instructions given to the CEO Agent</b> (not products). "Issue" terminology is replaced everywhere with "Task". Source: CEO Agent Task System.</div>
        </section>
      </div>
    );
  }

  // OPERATOR VIEW
  const runningSubtasksCount = agents ? agents.filter(a => a.status === "running" || a.status === "active").length : 4;
  const approvalQueueCount = data?.pendingApprovals ?? 2;
  const integrationBlockersCount = issues ? issues.filter(i => i.status === "blocked" || i.blockerAttention).length : 1;
  const totalCalls24h = 312;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <section className="page active" id="op-exec">
        <div className="page-head">
          <div className="eyebrow">Operator Dashboard</div>
          <h1>Execution</h1>
          <p>Live agent execution across all tasks. This is the engine room — full technical detail, retries, and raw status.</p>
        </div>

        <div className="grid g4">
          <div className="card stat">
            <span className="label">Running subtasks</span>
            <span className="num">{runningSubtasksCount}</span>
          </div>
          <div className="card stat">
            <span className="label">Approval queue</span>
            <span className="num">{approvalQueueCount}</span>
          </div>
          <div className="card stat">
            <span className="label">Integration blockers</span>
            <span className="num" style={{ color: "#ef8472" }}>{integrationBlockersCount}</span>
          </div>
          <div className="card stat">
            <span className="label">Agent calls (24h)</span>
            <span className="num">{totalCalls24h}</span>
          </div>
        </div>

        <h2 className="section-title">CEO Agent → subtask assignment · GUMA-33</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Subtask</th>
              <th>Agent</th>
              <th>Model</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(agents ?? []).slice(0, 8).map((agent) => {
              const adapterType = agent.adapterType ?? "claude-3-5-sonnet";
              const isRunning = agent.status === "running";
              const isPaused = agent.status === "paused";
              const isError = agent.status === "error";

              let statusBadge = <span className="badge b-done">active</span>;
              if (isRunning) {
                statusBadge = <span className="badge b-progress">running</span>;
              } else if (isPaused) {
                statusBadge = <span className="badge b-blocked">paused</span>;
              } else if (isError) {
                statusBadge = <span className="badge b-blocked">error</span>;
              }

              return (
                <tr key={agent.id}>
                  <td>{agent.role}.execute</td>
                  <td>{agent.name}</td>
                  <td><span className="tid">{String(adapterType)}</span></td>
                  <td>{statusBadge}</td>
                  <td>—</td>
                  <td>
                    <Link to={`/agents/${agent.urlKey}`} className="linklike">
                      view
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(agents ?? []).length === 0 && (
              <>
                <tr>
                  <td>goal.decompose</td>
                  <td>CEO</td>
                  <td><span className="tid">claude-opus</span></td>
                  <td><span className="badge b-done">complete</span></td>
                  <td>4.1s</td>
                  <td><span className="linklike">trace</span></td>
                </tr>
                <tr>
                  <td>strategy.channel_plan</td>
                  <td>CMO</td>
                  <td><span className="tid">claude-sonnet</span></td>
                  <td><span className="badge b-done">complete</span></td>
                  <td>2.7s</td>
                  <td><span className="linklike">trace</span></td>
                </tr>
                <tr>
                  <td>publish.shopify.article</td>
                  <td>Operator</td>
                  <td><span className="tid">shopify-mcp</span></td>
                  <td><span className="badge b-blocked">blocked · 400</span></td>
                  <td>retry 2/3</td>
                  <td><span className="linklike" style={{ color: "#e6b958" }}>retry</span></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
