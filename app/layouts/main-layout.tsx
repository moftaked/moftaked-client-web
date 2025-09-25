import { NavLink, Outlet, useNavigate } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "~/components/ui/sidebar";
import { useEffect, useState } from "react";
import { ModeToggle } from "~/components/mode-toggle";
import { useIsMobile } from "~/hooks/use-mobile";
import { cn, isAuthenticated } from "~/lib/utils";
import { Logout } from "~/components/logout";
import { SlidingContainer } from "~/components/sliding-container";
import { useNavigation } from "~/contexts/navigation-context";

export default function MainLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  if (!isAuthenticated()) {
    navigate('/login');
  }
  return (
    <div className="px-6 py-15 md:px-2 md:py-2">
      {isMobile ? <BottomNavBarLayout /> : <SidebarLayout />}
    </div>
  );
}

function SidebarLayout() {
  const navigation = useNavigation();
  const items = navigation.getSidebarItems();
  const [opened, setOpened] = useState(localStorage.getItem("sidebar_state") === "true");
  useEffect(() => {
    localStorage.setItem("sidebar_state", opened ? "true" : "false");
  }, [opened]);
  return (
    <SidebarProvider open={opened} onOpenChange={setOpened}>
      <Sidebar side="right" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end>
                        <item.icon />
                        <span className="text-base">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {opened ? (
            <div className="flex flex-row gap-3">
              <Logout className="grow" />
              <ModeToggle />
            </div>) : <ModeToggle className="size-8" />
          }
        </SidebarFooter>
      </Sidebar>
      <main>
        <SidebarTrigger />
        <Outlet />
      </main>
    </SidebarProvider>
  );
}

function BottomNavBarLayout() {
  const navigation = useNavigation();
  const items = navigation.getBottomNavItems();
  return (
    <>
      <main className="pb-14">
        <SlidingContainer className="h-full">
          <Outlet />
        </SlidingContainer>
      </main>
      <div className="flex rtl:flex-row-reverse flex-row justify-between fixed bottom-0 left-0 right-0 w-dvw h-14 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-sidebar">
        {items.map((item) => (
          <NavLink key={item.title} to={item.url} className="width-fit h-full pb-3 pt-1.5 block">
              {({ isActive }) => (
                <div className={cn("flex items-center justify-center min-w-fit w-13 h-full rounded", isActive? "bg-primary": '')}>
                  <item.icon className={isActive? 'text-sidebar dark:text-white' : ''} fill={isActive ? "currentColor" : "none"} />
                </div>
              )}
            </NavLink>
        ))}
      </div>
    </>
  );
}