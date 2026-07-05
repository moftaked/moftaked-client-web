import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
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

function parseValue(value: string): { date: Date; hours: number; minutes: number } {
  if (!value) {
    const now = new Date();
    return { date: now, hours: now.getHours(), minutes: now.getMinutes() };
  }
  const d = new Date(value + (value.includes("T") ? "" : "T00:00:00"));
  return {
    date: d,
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

function formatDateTime(date: Date, hours: number, minutes: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function to12h(hours: number): { h12: number; pm: boolean } {
  if (hours === 0) return { h12: 12, pm: false };
  if (hours <= 11) return { h12: hours, pm: false };
  if (hours === 12) return { h12: 12, pm: true };
  return { h12: hours - 12, pm: true };
}

function from12h(h12: number, pm: boolean): number {
  if (!pm) return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function DatePicker({
  value,
  onChange,
  showTime = false,
}: {
  value: string;
  onChange: (date: string) => void;
  showTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { date: selected, hours: selectedHours, minutes: selectedMinutes } = parseValue(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [viewYear, setViewYear] = useState(selected.getFullYear());

  const { h12: displayHour, pm: isPM } = to12h(selectedHours);

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
    onChange(formatDateTime(d, selectedHours, selectedMinutes));
    if (!showTime) setOpen(false);
  }

  function handleTimeChange(h12: number, pm: boolean, minutes: number) {
    onChange(formatDateTime(selected, from12h(h12, pm), minutes));
  }

  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const displayText = showTime
    ? `${formatArabicDate(selected)} ${String(displayHour).padStart(2, "0")}:${String(selectedMinutes).padStart(2, "0")} ${isPM ? "م" : "ص"}`
    : formatArabicDate(selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex h-9 min-w-[140px] justify-start gap-2 px-3 text-sm font-normal"
          dir="rtl"
        >
          <span>{displayText}</span>
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

          {showTime && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Clock className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1 flex-1">
                <Select
                  value={String(displayHour)}
                  onValueChange={(v) => handleTimeChange(parseInt(v, 10), isPM, selectedMinutes)}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS_12.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select
                  value={String(selectedMinutes)}
                  onValueChange={(v) => handleTimeChange(displayHour, isPM, parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minutes.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {String(m).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => handleTimeChange(displayHour, true, selectedMinutes)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    isPM
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  م
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange(displayHour, false, selectedMinutes)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    !isPM
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  ص
                </button>
              </div>
              <Button size="sm" onClick={() => setOpen(false)}>
                تم
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
