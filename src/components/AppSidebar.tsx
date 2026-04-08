import {
  BarChart3,
  PenSquare,
  MessageSquare,
  Send,
  LayoutDashboard,
  Settings,
  User,
  Shield,
  Search,
  Globe,
  ArrowRightLeft,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/contexts/AccountTypeContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const { switchView } = useAccountType();
  const ar = language === "ar";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  const fullName: string = (user?.user_metadata?.full_name as string) || "";
  const email: string = user?.email || "";
  const initials = fullName
    ? fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const mainItems = [{ title: ar ? "لوحة التحكم" : "Dashboard", url: "/dashboard", icon: LayoutDashboard }];

  const resumeItems = [
    { title: ar ? "كتابة السيرة" : "Resume Builder", url: "/builder", icon: PenSquare },
    { title: ar ? "تحليل CV" : "CV Analysis", url: "/analysis", icon: BarChart3 },
  ];

  const interviewItems = [
    { title: ar ? "المقابلة الذكية" : "AI Interview", url: "/dashboard/interview-avatar", icon: MessageSquare },
  ];

  const marketingItems = [{ title: ar ? "Smart Send" : "Smart Send", url: "/marketing", icon: Send }];
  const jobItems = [{ title: ar ? "البحث عن الوظائف" : "Job Search", url: "/job-search", icon: Search }];

  const renderItem = (item: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const handleSwitchToRecruiter = () => {
    switchView("recruiter");
    navigate("/recruiter/dashboard");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleLanguage = () => setLanguage(ar ? "en" : "ar");

  return (
    <Sidebar collapsible="icon" side={ar ? "right" : "left"}>
      <SidebarHeader className="p-4 pb-2">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          {!collapsed ? (
            <span className="font-display text-xl font-bold text-sidebar-foreground">
              TALEN<span className="text-sidebar-primary">TRY</span>
            </span>
          ) : (
            <span className="font-display text-lg font-bold text-sidebar-primary">T</span>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "خدمات السيرة" : "Resume"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{resumeItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "المقابلات" : "Interview"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{interviewItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "التسويق" : "Marketing"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{marketingItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-display px-3">
              {ar ? "الوظائف" : "Jobs"}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{jobItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderItem({ title: ar ? "لوحة الأدمن" : "Admin", url: "/admin", icon: Shield })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center w-full rounded-xl px-2 py-2 gap-3 hover:bg-sidebar-accent transition-colors group ${collapsed ? "justify-center" : ""}`}
            >
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/20 group-hover:ring-sidebar-primary/40 transition-all">
                <AvatarImage src={user?.user_metadata?.avatar_url as string} />
                <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-start">
                    {fullName && (
                      <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{fullName}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">{email}</p>
                  </div>
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-sidebar-foreground transition-colors" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align={ar ? "end" : "start"} sideOffset={8} className="w-56 mb-1">
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-xs font-semibold text-foreground truncate">{fullName || email}</p>
              {fullName && <p className="text-[10px] text-muted-foreground truncate">{email}</p>}
            </div>

            <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2.5 cursor-pointer">
              <User className="h-4 w-4 text-muted-foreground" />
              {ar ? "الملف الشخصي" : "Profile"}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2.5 cursor-pointer">
              <Settings className="h-4 w-4 text-muted-foreground" />
              {ar ? "الإعدادات" : "Settings"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSwitchToRecruiter} className="gap-2.5 cursor-pointer">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              {ar ? "لوحة التوظيف" : "Recruiter Panel"}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={toggleLanguage} className="gap-2.5 cursor-pointer">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {ar ? "Switch to English" : "التبديل للعربية"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="gap-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              {ar ? "تسجيل الخروج" : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
