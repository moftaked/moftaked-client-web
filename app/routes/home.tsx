import api from "~/lib/api";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

export async function clientLoader() {
  const schools = await api.get<{ 
    school_id: number, 
    school_name: string, 
    classes: { class_id: number, class_name: string }[] 
  }[]>('/classes');
  // todo: redirect user if one class
  return { schools: schools.data };
}

export default function Home({
  loaderData,
}: Route.ComponentProps) {
  const { schools } = loaderData;
  return (
    <>
      <h1 className="text-xl font-bold">الخدمات بتاعتك</h1>
      {schools.length > 1 ? <MultipleSchoolsLayout schools={schools} /> : <OneSchoolLayout classes={schools[0].classes} />}
    </>
  );
}

function OneSchoolLayout({ classes }: { classes: { class_id: number, class_name: string }[] }) {
  return <ClassesCol classes={classes} />;
}

function MultipleSchoolsLayout({ schools }: { schools: { 
  school_id: number, 
  school_name: string, 
  classes: { class_id: number, class_name: string }[] 
}[] }) {
  return (
    <div className="flex flex-col gap-4">
      {schools.map((school) => (
        <>
          { 
            school.classes.length > 3 ? 
              <SchoolWithManyClasses key={school.school_id} school={school} /> : 
              <SchoolWithFewClasses key={school.school_id} school={school} />
          }
        </>
      ))}
    </div>
  );
}

function SchoolWithManyClasses({ school }: { school: { school_id: number, school_name: string, classes: { class_id: number, class_name: string }[] } }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="justify-start text-lg p-5">
          {school.school_name}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <ClassesCol classes={school.classes} />
      </PopoverContent>
    </Popover>
  );
}

function SchoolWithFewClasses({ school }: { school: { school_id: number, school_name: string, classes: { class_id: number, class_name: string }[] } }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{school.school_name}</h2>
      <ClassesCol classes={school.classes} />
    </div>
  );
}

function ClassesCol({ classes }: { classes: { class_id: number, class_name: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {classes.map((cls) => (
        <Button key={cls.class_id} className="justify-start text-lg p-5">
          {cls.class_name}
        </Button>
      ))}
    </div> 
  );
}