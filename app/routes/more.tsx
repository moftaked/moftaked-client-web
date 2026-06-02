import { Logout } from "~/components/logout";
import { ModeToggle } from "~/components/mode-toggle";
import { isManager } from "~/lib/utils";
import { Link } from "react-router";
import { ShieldCheck, ArrowLeftRight, School, CalendarDays } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function More() {
  const userIsManager = isManager();

  return (
    <div className="flex flex-col gap-3">
      {userIsManager && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">إدارة</h2>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/accounts">
              <ShieldCheck className="size-4" />
              إدارة الحسابات
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/persons">
              <ArrowLeftRight className="size-4" />
              نقل و تعيين الأشخاص
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/classes">
              <School className="size-4" />
              إدارة الخدمات والفصول
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/admin/events">
              <CalendarDays className="size-4" />
              إدارة الغياب
            </Link>
          </Button>
        </div>
      )}
      <ModeToggle />
      <Logout />
    </div>
  );
}