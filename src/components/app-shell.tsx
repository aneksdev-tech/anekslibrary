
import {
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Bell,
  Bookmark,
  Crown,
  Home,
  Library,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Upload,
  User,
  GraduationCap,
  FileCheck2,
  Megaphone,
  Shield,
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import logo from "@/assets/Aneks_Library_Logo.png";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
  admin?: boolean;
  academic?: boolean;
}

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Overview",
  },
  {
    to: "/library",
    icon: Library,
    label: "Library",
  },
  {
    to: "/upload",
    icon: Upload,
    label: "Upload",
  },
  {
    to: "/my-uploads",
    icon: FileCheck2,
    label: "My Uploads",
  },
  {
    to: "/bookmarks",
    icon: Bookmark,
    label: "Bookmarks",
  },
  {
    to: "/premium",
    icon: Crown,
    label: "Premium",
  },
  {
    to: "/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    to: "/announcements",
    icon: Megaphone,
    label: "Announcements",
  },
  {
    to: "/profile",
    icon: User,
    label: "Profile",
  },
  {
    to: "/academic",
    icon: GraduationCap,
    label: "Academic",
    academic: true,
  },
  {
    to: "/admin",
    icon: Shield,
    label: "Admin",
    admin: true,
  },
];

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const {
    profile,
    signOut,
    user,
  } = useAuth();

  const {
    theme,
    toggle,
  } = useTheme();

  const nav = useNavigate();
  const queryClient = useQueryClient();

  const pathname = useRouterState({
    select: (r) => r.location.pathname,
  });

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const role = profile?.primary_role;

  const canAccessAdmin =
    role === "admin" ||
    role === "co-admin" ||
    role === "staff";

  const canAccessAcademic =
    role === "lecturer";

  const {
    data: attentionCount = 0,
  } = useQuery({
    queryKey: [
      "workspace-attention-count",
      user?.id,
      role,
    ],
    enabled:
      !!user &&
      (
        role === "admin" ||
        role === "co-admin" ||
        role === "staff" ||
        role === "lecturer"
      ),
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_workspace_attention_count",
      );

      if (error) {
        throw error;
      }

      return data ?? 0;
    },
    staleTime: 10_000,
refetchOnMount: true,
refetchOnWindowFocus: true,
refetchOnReconnect: true,
refetchInterval: 15_000,
  });

  const {
    data: notificationCount = 0,
  } = useQuery({
    queryKey: [
      "notif-count",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        count,
        error,
      } = await supabase
        .from("notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", user!.id)
        .eq("read", false);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    staleTime: 10_000,
refetchOnMount: true,
refetchOnWindowFocus: true,
refetchOnReconnect: true,
refetchInterval: 15_000,
  });

  const {
    data: announcementCount = 0,
  } = useQuery({
    queryKey: [
      "announcement-count",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_unread_announcement_count",
      );

      if (error) {
        throw error;
      }

      return data ?? 0;
    },
    staleTime: 10_000,
refetchOnMount: true,
refetchOnWindowFocus: true,
refetchOnReconnect: true,
refetchInterval: 15_000,
  });

  // Refresh relevant counts when entering their pages.
useEffect(() => {
  if (!user?.id) {
    return;
  }

  if (pathname.startsWith("/notifications")) {
    void queryClient.invalidateQueries({
      queryKey: ["notif-count", user.id],
    });
  }

  if (pathname.startsWith("/announcements")) {
    void queryClient.invalidateQueries({
      queryKey: ["announcement-count", user.id],
    });
  }

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/academic")
  ) {
    void queryClient.invalidateQueries({
      queryKey: ["workspace-attention-count", user.id, role],
    });
  }
}, [pathname, user?.id, role, queryClient]);

  const items = NAV.filter((n) => {
    if (n.admin) {
      return canAccessAdmin;
    }

    if (n.academic) {
      return canAccessAcademic;
    }

    return true;
  });

  const handleSignOut = async () => {
    await signOut();

    nav({
      to: "/auth",
      search: {
        mode: "login",
      },
    });
  };

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-50 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex md:w-60 lg:w-64">
        <Link
          to="/"
          className="flex items-center gap-0.5 px-4 py-6"
        >
          <img
            src={logo}
            alt="Aneks Library"
            className="h-10 w-10 rounded-lg object-contain"
          />

          <span className="-ml-2 font-display text-xs font-semibold tracking-tight sm:text-lg">
            <span className="text-gold">neks</span> Library
          </span>
        </Link>

        <SidebarNav
          items={items}
          pathname={pathname}
          attentionCount={attentionCount}
          notificationCount={notificationCount}
          announcementCount={announcementCount}
        />
      </aside>

      {/* Mobile navigation sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 flex w-46 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elegant sm:w-[11.5rem]">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex min-w-0 items-center"
              >
                <img
                  src={logo}
                  alt="Aneks Library"
                  className="h-8 w-8 shrink-0 rounded-lg object-contain"
                />

                <span className="-ml-1 truncate font-display text-[12px] font-semibold tracking-tight">
                  <span className="text-gold">neks</span>{" "}
                  Library
                </span>
              </Link>

              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SidebarNav
              items={items}
              pathname={pathname}
              attentionCount={attentionCount}
              notificationCount={notificationCount}
              announcementCount={announcementCount}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:ml-60 lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-sm border border-border p-2 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell count={notificationCount} />

            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-sm border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex cursor-pointer items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-sm transition-colors hover:text-muted-foreground">
                  <Avatar className="h-6 w-6">
  <AvatarImage
    src={profile?.avatar_url || undefined}
    alt={profile?.full_name || "Profile picture"}
    className="object-cover"
  />

  <AvatarFallback className="bg-gradient-emerald text-[10px] text-white">
    {(
      profile?.full_name ||
      user?.email ||
      "?"
    )
      .slice(0, 1)
      .toUpperCase()}
  </AvatarFallback>
</Avatar>

                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {profile?.full_name || user?.email}
                  </span>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56"
              >
                <DropdownMenuLabel className="truncate">
                  {user?.email}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  items,
  pathname,
  onNavigate,
  attentionCount,
  notificationCount,
  announcementCount,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  attentionCount: number;
  notificationCount: number;
  announcementCount: number;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-2 md:space-y-0 md:p-3">
      {items.map((item) => {
        const active =
          pathname === item.to ||
          (item.to !== "/dashboard" &&
            pathname.startsWith(`${item.to}/`) &&
            !(
              item.to === "/profile" &&
              pathname.startsWith("/profile/")
            ));

        const showAttentionBadge =
          (item.admin || item.academic) &&
          attentionCount > 0;

        const showNotificationBadge =
          item.to === "/notifications" &&
          notificationCount > 0;

        const showAnnouncementBadge =
          item.to === "/announcements" &&
          announcementCount > 0;

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`relative flex items-center justify-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors md:gap-3.5 md:px-3.5 md:py-3 lg:px-4 ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            }`}
            aria-label={item.label}
          >
            <item.icon className="h-4 w-4 shrink-0 md:h-5 md:w-5" />

            <span className="min-w-0 flex-1 text-xs md:text-sm">
              {item.label}
            </span>

            {showAttentionBadge ? (
              <span
                className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[9px] font-semibold text-gold-foreground md:h-5 md:min-w-5 md:text-[10px]"
                aria-label={`${attentionCount} pending items`}
              >
                {attentionCount > 99 ? "99+" : attentionCount}
              </span>
            ) : null}

            {showNotificationBadge ? (
              <span
                className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[9px] font-semibold text-gold-foreground md:h-5 md:min-w-5 md:text-[10px]"
                aria-label={`${notificationCount} unread notifications`}
              >
                {notificationCount > 99 ? "99+" : notificationCount}
              </span>
            ) : null}

            {showAnnouncementBadge ? (
              <span
                className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-gold px-1 text-[9px] font-semibold text-gold-foreground md:h-5 md:min-w-5 md:text-[10px]"
                aria-label={`${announcementCount} unread announcements`}
              >
                {announcementCount > 99 ? "99+" : announcementCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function NotificationBell({
  count,
}: {
  count: number;
}) {
  return (
    <Link
      to="/notifications"
      className="relative rounded-sm border border-border p-2 text-muted-foreground hover:text-foreground"
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />

      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
