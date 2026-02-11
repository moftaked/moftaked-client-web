import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Building2, Users, GraduationCap } from "lucide-react";

export interface School {
  id: string;
  name: string;
  location: string;
  totalClasses: number;
  totalStudents: number;
  principal: string;
}

interface SchoolCardProps {
  school: School;
  onViewClasses: () => void;
}

export function SchoolCard({
  school,
  onViewClasses,
}: SchoolCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="size-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>{school.name}</CardTitle>
              <CardDescription>
                {school.location}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>Principal: {school.principal}</span>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" />
              <span>{school.totalClasses} Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span>{school.totalStudents} Students</span>
            </div>
          </div>
          <Button
            onClick={onViewClasses}
            className="w-full mt-2"
          >
            View Classes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}