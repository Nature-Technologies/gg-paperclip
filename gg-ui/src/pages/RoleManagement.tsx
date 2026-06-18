import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accessApi, type CompanyMember, type HumanCompanyRole } from "../api/access";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useToastActions } from "../context/ToastContext";
import { Users, Shield, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";

// Permission matrix definition matching the mockup design
const ROLE_PERMISSIONS: Record<string, {
  ownerView: boolean;
  operatorView: boolean;
  createTask: boolean;
  approveContent: boolean;
  approveSpend: boolean;
  publishLive: boolean;
  configure: boolean;
  viewLogs: boolean;
}> = {
  owner: {
    ownerView: true,
    operatorView: false,
    createTask: false,
    approveContent: true,
    approveSpend: true,
    publishLive: false,
    configure: false,
    viewLogs: false,
  },
  admin: {
    ownerView: true,
    operatorView: true,
    createTask: true,
    approveContent: true,
    approveSpend: true,
    publishLive: true,
    configure: true,
    viewLogs: true,
  },
  operator: {
    ownerView: false,
    operatorView: true,
    createTask: true,
    approveContent: true,
    approveSpend: false,
    publishLive: true,
    configure: false,
    viewLogs: true,
  },
  viewer: {
    ownerView: true,
    operatorView: false,
    createTask: false,
    approveContent: false,
    approveSpend: false,
    publishLive: false,
    configure: false,
    viewLogs: false,
  },
};

const ROLE_LABELS: Record<HumanCompanyRole, string> = {
  owner: "Owner / CXO",
  admin: "Tech Build Lead",
  operator: "Marketing Operator",
  viewer: "Viewer",
};

const DASHBOARD_LABELS: Record<HumanCompanyRole, string> = {
  owner: "Owner",
  admin: "Operator",
  operator: "Operator",
  viewer: "Owner",
};

function CheckIcon() {
  return <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />;
}

function DashIcon() {
  return <span className="text-muted-foreground/40 block text-center">–</span>;
}

function RoleSelectCell({
  member,
  companyId,
  canManage,
}: {
  member: CompanyMember;
  companyId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: (role: HumanCompanyRole) =>
      accessApi.updateMember(companyId, member.id, { membershipRole: role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.companyMembers(companyId) });
      pushToast({ title: "Role updated", body: member.user?.name ?? "User", tone: "success" });
      setEditing(false);
    },
    onError: (error) => {
      pushToast({
        title: "Failed to update role",
        body: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    },
  });

  const currentRole = member.membershipRole as HumanCompanyRole | null;
  const label = currentRole ? ROLE_LABELS[currentRole] : "No role";
  const dashboardLabel = currentRole ? DASHBOARD_LABELS[currentRole] : "—";

  const dashBadgeCls = currentRole === "owner" || currentRole === "viewer"
    ? "badge b-progress"
    : "badge b-done";

  if (!canManage) {
    return (
      <>
        <td>{label}</td>
        <td><span className={dashBadgeCls}>{dashboardLabel}</span></td>
      </>
    );
  }

  if (editing) {
    return (
      <>
        <td>
          <select
            className="text-sm bg-background border border-border rounded px-2 py-1"
            defaultValue={currentRole ?? ""}
            autoFocus
            disabled={mutation.isPending}
            onChange={(e) => {
              const val = e.target.value as HumanCompanyRole;
              if (val) mutation.mutate(val);
            }}
            onBlur={() => setEditing(false)}
          >
            <option value="" disabled>Select role…</option>
            <option value="owner">Owner / CXO</option>
            <option value="admin">Tech Build Lead</option>
            <option value="operator">Marketing Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </td>
        <td><span className={dashBadgeCls}>{dashboardLabel}</span></td>
      </>
    );
  }

  return (
    <>
      <td>
        <button
          type="button"
          className="linklike text-left"
          onClick={() => setEditing(true)}
          title="Click to change role"
        >
          {label}
        </button>
      </td>
      <td><span className={dashBadgeCls}>{dashboardLabel}</span></td>
    </>
  );
}

export function RoleManagement() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();

  useEffect(() => {
    setBreadcrumbs([{ label: "Role Management" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.access.companyMembers(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Shield} message="Select a company to manage roles." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const members = data?.members ?? [];
  const canManage = data?.access.canManageMembers ?? false;

  const totalUsers = members.length;
  const ownerCount = members.filter(m => m.membershipRole === "owner").length;
  const operatorCount = members.filter(m => m.membershipRole === "operator" || m.membershipRole === "admin").length;
  const adminCount = members.filter(m => m.membershipRole === "admin").length;

  const activeMembers = members.filter(m => m.status === "active");
  const pendingMembers = members.filter(m => m.status === "pending");

  function getPermission(role: HumanCompanyRole | null, key: keyof typeof ROLE_PERMISSIONS["owner"]): boolean {
    if (!role) return false;
    return ROLE_PERMISSIONS[role]?.[key] ?? false;
  }

  function getKeyPermissions(member: CompanyMember): string[] {
    const role = member.membershipRole as HumanCompanyRole | null;
    if (!role) return [];
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return [];
    const tags: string[] = [];
    if (perms.approveContent) tags.push("Approve content");
    if (perms.approveSpend) tags.push("Approve spend");
    if (perms.publishLive) tags.push("Publish");
    if (perms.configure) tags.push("Configure");
    if (perms.viewLogs) tags.push("View logs");
    if (perms.createTask) tags.push("Create task");
    return tags.slice(0, 3);
  }

  const uniqueRoles = Array.from(new Set(
    members
      .map(m => m.membershipRole)
      .filter((r): r is HumanCompanyRole => r !== null)
  ));

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      <section className="page active" id="op-roles">
        <div className="page-head">
          <div className="eyebrow">Operator Dashboard</div>
          <h1>Role Management</h1>
          <p>
            Control who can reach each dashboard, approve work, publish to live channels,
            and view technical logs. Owners never see this surface.
          </p>
        </div>

        {/* Stats */}
        <div className="grid g4">
          <div className="card stat">
            <span className="label">Total users</span>
            <span className="num">{totalUsers}</span>
          </div>
          <div className="card stat">
            <span className="label">Owner access</span>
            <span className="num">{ownerCount}</span>
          </div>
          <div className="card stat">
            <span className="label">Operator access</span>
            <span className="num">{operatorCount}</span>
          </div>
          <div className="card stat">
            <span className="label">Admin / Tech Lead</span>
            <span className="num">{adminCount}</span>
          </div>
        </div>

        {/* Users Table */}
        <h2 className="section-title" style={{ marginTop: 24 }}>Users</h2>
        {members.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted-foreground)" }}>
            <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>No users found. Invite members to the company to manage their roles.</p>
            <Link to="/company/settings/invites" className="btn btn-primary" style={{ marginTop: 16, display: "inline-block", padding: "9px 18px", width: "auto" }}>
              Invite users
            </Link>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Dashboard</th>
                <th>Key permissions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const name = member.user?.name ?? member.user?.email ?? "Unknown user";
                const email = member.user?.email;
                const keyPerms = getKeyPermissions(member);
                const isActive = member.status === "active";
                const isPending = member.status === "pending";
                const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

                return (
                  <tr key={member.id}>
                    <td>
                      <div className="t-name" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "var(--accent)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 600, flexShrink: 0,
                          color: "var(--foreground)",
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{name}</div>
                          {email && <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{email}</div>}
                        </div>
                      </div>
                    </td>
                    <RoleSelectCell member={member} companyId={selectedCompanyId} canManage={canManage} />
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {keyPerms.length > 0
                          ? keyPerms.map(p => <span key={p} className="tagk">{p}</span>)
                          : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>None assigned</span>
                        }
                      </div>
                    </td>
                    <td>
                      {isActive && <span className="badge b-live">Active</span>}
                      {isPending && <span className="badge b-pending">Invited</span>}
                      {!isActive && !isPending && <span className="badge b-blocked">{member.status}</span>}
                    </td>
                    <td>
                      <Link to={`/company/settings/members`} className="linklike">
                        manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="devnote">
          Roles are company-scoped. Click a role to change it inline.
          Full permission management (grants, overrides) is in{" "}
          <Link to="/company/settings/members" className="linklike">Company Settings → Members</Link>.
        </div>

        {/* Permissions Matrix */}
        <h2 className="section-title" style={{ marginTop: 32 }}>Roles &amp; permissions</h2>
        <div className="matrix-wrap">
          <table className="tbl matrix">
            <thead>
              <tr>
                <th>Role</th>
                <th>Owner view</th>
                <th>Operator view</th>
                <th>Create task</th>
                <th>Approve content</th>
                <th>Approve spend</th>
                <th>Publish live</th>
                <th>Configure</th>
                <th>View logs</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(ROLE_PERMISSIONS) as HumanCompanyRole[]).map((role) => {
                const p = ROLE_PERMISSIONS[role];
                const usersWithRole = members.filter(m => m.membershipRole === role);
                return (
                  <tr key={role}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong>{ROLE_LABELS[role]}</strong>
                        {usersWithRole.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                            {usersWithRole.length} user{usersWithRole.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={p.ownerView ? "yes" : "no"}>{p.ownerView ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.operatorView ? "yes" : "no"}>{p.operatorView ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.createTask ? "yes" : "no"}>{p.createTask ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.approveContent ? "yes" : "no"}>{p.approveContent ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.approveSpend ? "yes" : "no"}>{p.approveSpend ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.publishLive ? "yes" : "no"}>{p.publishLive ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.configure ? "yes" : "no"}>{p.configure ? <CheckIcon /> : <DashIcon />}</td>
                    <td className={p.viewLogs ? "yes" : "no"}>{p.viewLogs ? <CheckIcon /> : <DashIcon />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="devnote">
          Permissions are role-based with per-user overrides available in{" "}
          <Link to="/company/settings/members" className="linklike">Company Settings → Members</Link>.
          The $100/day ad-spend gate and approve-before-publish guardrail are enforced system-wide.
          Owner-view access controls hide technical surfaces (logs, integrations, MCP errors) from owners.
        </div>
      </section>
    </div>
  );
}
