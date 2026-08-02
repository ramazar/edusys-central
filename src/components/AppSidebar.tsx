import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserCog,
  HardHat,
  Wallet,
  CalendarCheck,
  FileBarChart,
  Settings,
  ScrollText,
  GraduationCap,
  ClipboardList,
  Sprout,
  BookCheck,
  Building2,
  Code2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AppRole } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; roles: AppRole[] };

const items: Item[] = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard, roles: ["admin","accountant","reception","teacher"] },
  { title: "الطلاب", url: "/students", icon: Users, roles: ["admin","accountant","reception","teacher"] },
  { title: "الحضور", url: "/attendance", icon: CalendarCheck, roles: ["admin","reception","teacher"] },
  { title: "العلامات", url: "/marks", icon: ClipboardList, roles: ["admin","teacher","reception"] },
  { title: "الحصاد العلمي", url: "/harvest", icon: Sprout, roles: ["admin","teacher","reception"] },
  { title: "الواجبات", url: "/homework", icon: BookCheck, roles: ["admin","teacher","reception"] },
  { title: "المعلمون", url: "/teachers", icon: UserCog, roles: ["admin","accountant","reception","teacher"] },
  { title: "العمال", url: "/workers", icon: HardHat, roles: ["admin","accountant","reception"] },
  { title: "المالية", url: "/finance", icon: Wallet, roles: ["admin","accountant"] },
  { title: "التقارير", url: "/reports", icon: FileBarChart, roles: ["admin","accountant","reception","teacher"] },
  { title: "سجل المراجعة", url: "/audit", icon: ScrollText, roles: ["admin"] },
  { title: "الإعدادات", url: "/settings", icon: Settings, roles: ["admin"] },
  { title: "عن المطوّر", url: "/developer", icon: Code2, roles: ["admin","accountant","reception","teacher"] },
];

export function AppSidebar({ roles, isSuperAdmin = false }: { roles: AppRole[]; isSuperAdmin?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const visible = [
    ...(isSuperAdmin
      ? [{ title: "المدارس", url: "/schools", icon: Building2, roles: [] as AppRole[] }]
      : []),
    // A super admin browsing a school holds no role inside it, but still sees everything.
    ...items.filter((i) => isSuperAdmin || i.roles.some((r) => roles.includes(r))),
  ];
  const { data: branding } = useBranding();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="شعار المدرسة"
              className="h-9 w-9 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{branding?.schoolName ?? "SchoolDesk"}</div>
              <div className="truncate text-xs text-muted-foreground">إدارة المدرسة</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="!h-5 !w-5 shrink-0" />
                        <span>{item.title}</span>
                      </Link>

                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
