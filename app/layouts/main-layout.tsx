import { NavLink, Outlet } from "react-router";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { HomeIcon, LogOutIcon } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { ModeToggle } from "~/components/mode-toggle";

export default function _Sidebar() {
  const items = [
    { title: "البيت", url: "/", icon: HomeIcon },
  ];
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
            <Button className="grow" onClick={() => {
              localStorage.removeItem('authToken');
              window.location.reload();
            }}>
              <LogOutIcon />
            </Button>
            <ModeToggle />
          </div>) : <ModeToggle className="size-8" />
          }
        </SidebarFooter>
      </Sidebar>
      <main className="p-3">
        <SidebarTrigger />
        <Outlet />
      </main>
    </SidebarProvider>
  );
}