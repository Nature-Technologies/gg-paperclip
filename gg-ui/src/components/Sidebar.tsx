import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  GitBranch,
  Package,
  Settings,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  MessagesSquare,
  AlertTriangle,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarAgents } from "./SidebarAgents";
import { SidebarProjects } from "./SidebarProjects";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, SIDEBAR_RAIL_HIDDEN_LABEL } from "../lib/utils";
import { PluginSlotOutlet } from "@/plugins/slots";
import { PluginLauncherOutlet } from "@/plugins/launchers";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";

export function Sidebar() {
  const { openNewIssue } = useDialogActions();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isMobile, collapsed, collapseLocked, peeking, toggleCollapsed, setCollapsed } = useSidebar();
  const { viewMode } = useTheme();
  const rail = collapsed && !peeking;
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;
  const showWorkspacesLink = experimentalSettings?.enableIsolatedWorkspaces === true;
  const streamlined = experimentalSettings?.enableStreamlinedLeftNavigation === true;
  const conferenceRoomChatEnabled = experimentalSettings?.enableConferenceRoomChat === true;

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name (bold) + Search */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        <SidebarCompanyMenu />
        {!rail ? (
          <>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground shrink-0"
              aria-label="Open search"
              title="Open search"
            >
              <NavLink to="/search">
                <Search className="h-4 w-4" />
              </NavLink>
            </Button>
            {!isMobile && !collapseLocked ? (
              peeking ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground shrink-0"
                  aria-label="Keep sidebar expanded"
                  title="Keep sidebar expanded"
                  onClick={() => setCollapsed(false)}
                >
                  <Pin className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground shrink-0"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() => toggleCollapsed()}
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              )
            ) : null}
          </>
        ) : null}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 pointer-coarse:gap-3 px-3 py-2">
        {viewMode === "owner" ? (
          // OWNER NAV
          <div className="flex flex-col gap-0.5">
            <div className="nav-label">Marketing & Growth</div>
            <SidebarNavItem to="/dashboard" label="Overview" icon={LayoutDashboard} liveCount={liveRunCount} />
            <SidebarNavItem
              to="/issues"
              label="Strategic Tasks"
              icon={CircleDot}
              badge={inboxBadge.inbox > 0 ? inboxBadge.inbox : undefined}
              badgeTone="danger"
            />
            <SidebarNavItem to="/issues" label="Task Detail" icon={FolderOpen} />
            <SidebarNavItem to="/routines" label="Agent Workflow" icon={Network} />

            <div className="nav-label">Analytics</div>
            <SidebarNavItem to="/costs" label="Marketing Performance" icon={DollarSign} />
            <SidebarNavItem to="/activity" label="Task Performance" icon={History} />

            <div className="nav-label">Governance</div>
            <SidebarNavItem
              to="/inbox"
              label="Approvals"
              icon={Inbox}
              badge={inboxBadge.inbox > 0 ? inboxBadge.inbox : undefined}
              badgeTone="danger"
            />
            <SidebarNavItem to="/issues?status=blocked" label="Blockers" icon={AlertTriangle} />
            <SidebarNavItem to="/artifacts" label="Reports" icon={Package} />
            <SidebarNavItem to="/goals" label="AI Recommendations" icon={Target} />
          </div>
        ) : (
          // OPERATOR NAV
          <div className="flex flex-col gap-0.5">
            <div className="nav-label">Command Center</div>
            <SidebarNavItem to="/dashboard" label="Execution" icon={History} liveCount={liveRunCount} />
            <SidebarNavItem to="/agents/all" label="Agent Management" icon={Users} />
            <SidebarNavItem
              to="/inbox"
              label="Approval Queue"
              icon={Inbox}
              badge={inboxBadge.inbox > 0 ? inboxBadge.inbox : undefined}
            />
            <SidebarNavItem to="/skills" label="Integrations" icon={Boxes} />

            <div className="nav-label">System Monitoring</div>
            <SidebarNavItem to="/activity" label="Execution Logs" icon={History} />

            <div className="nav-label">Configuration</div>
            <button
              type="button"
              onClick={() => openNewIssue()}
              className="flex items-center gap-2.5 px-3 py-2 pointer-coarse:py-1.5 text-[13px] font-medium text-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors w-full text-left rounded-md"
            >
              <SquarePen className="h-4 w-4 shrink-0" />
              <span>Master Task Creation</span>
            </button>
            <SidebarNavItem to="/org/roles" label="Role Management" icon={Network} />
            <SidebarNavItem to="/company/settings" label="Settings" icon={Settings} />
          </div>
        )}

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
