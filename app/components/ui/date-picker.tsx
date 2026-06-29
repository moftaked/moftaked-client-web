import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

const DAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatArabicDate(date: Date): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [viewYear, setViewYear] = useState(selected.getFullYear());

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 1) % 7;

  const rows: (number | null)[][] = [];
  let cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
    if (cells.length === 7) {
      rows.push(cells);
      cells = [];
    }
  }

  if (cells.length > 0) {
    while (cells.length < 7) cells.push(null);
    rows.push(cells);
  }

  function isSelected(day: number) {
    return (
      selected.getDate() === day &&
      selected.getMonth() === viewMonth &&
      selected.getFullYear() === viewYear
    );
  }

  function isToday(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    return d.getTime() === today.getTime();
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    const iso = d.toISOString().split("T")[0];
    onChange(iso);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex h-9 min-w-[140px] justify-start gap-2 px-3 text-sm font-normal"
          dir="rtl"
        >
          <span>{formatArabicDate(selected)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div dir="rtl">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={prevMonth}
            >
              <ChevronRight className="size-4" />
            </Button>
            <span className="text-sm font-medium">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={nextMonth}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-xs text-muted-foreground h-8 w-8 flex items-center justify-center"
              >
                {d}
              </div>
            ))}

            {rows.map((week, wi) =>
              week.map((day, di) =>
                day ? (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "h-8 w-8 rounded-md text-sm transition-colors",
                      isSelected(day) &&
                        "bg-primary text-primary-foreground",
                      !isSelected(day) && isToday(day) &&
                        "border border-primary text-primary",
                      !isSelected(day) &&
                        !isToday(day) &&
                        "hover:bg-muted text-foreground"
                    )}
                  >
                    {day}
                  </button>
                ) : (
                  <div key={`${wi}-${di}`} className="h-8 w-8" />
                )
              )
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
