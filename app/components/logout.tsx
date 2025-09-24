import { LogOutIcon } from "lucide-react";
import { Button } from "./ui/button";

export function Logout({className}: {className?: string}) {
  return (
    <Button className={className} onClick={() => {
      localStorage.removeItem('authToken');
      window.location.reload();
    }}>
      <LogOutIcon />
    </Button>
  )
}