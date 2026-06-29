import { LogOutIcon } from "lucide-react";
import { Button } from "./ui/button";
import { clearAllOfflineData } from "~/lib/offline-db";
import { resetTimestampCache } from "~/lib/sync-manager";
import api from "~/lib/api";

export function Logout({className}: {className?: string}) {
  return (
    <Button className={className} onClick={async () => {
      try {
        await api.post('/auth/logout');
      } catch {
        // proceed with local cleanup regardless of API result
      }
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRoles');
      resetTimestampCache();
      await clearAllOfflineData();
      window.location.reload();
    }}>
      <LogOutIcon />
    </Button>
  )
}
