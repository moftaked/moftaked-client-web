import { LogOutIcon } from "lucide-react";
import { Button } from "./ui/button";
import { clearAllOfflineData } from "~/lib/offline-db";
import { resetTimestampCache } from "~/lib/sync-manager";

export function Logout({className}: {className?: string}) {
  return (
    <Button className={className} onClick={async () => {
      localStorage.removeItem('authToken');
      resetTimestampCache();
      await clearAllOfflineData();
      window.location.reload();
    }}>
      <LogOutIcon />
    </Button>
  )
}