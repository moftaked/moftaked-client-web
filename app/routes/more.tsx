import { Logout } from "~/components/logout";
import { ModeToggle } from "~/components/mode-toggle";

export default function More() {
  return (
    <div className="flex flex-col gap-3">
      <ModeToggle />
      <Logout />
    </div>
  );
}