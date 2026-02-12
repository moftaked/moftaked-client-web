import { createContext, useContext, useState, type ReactNode } from "react";

interface AvailableDate {
  date: string;
  display_date: string;
}

interface ReportsDateContextValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  availableDates: AvailableDate[];
  setAvailableDates: (dates: AvailableDate[]) => void;
}

const ReportsDateContext = createContext<ReportsDateContextValue | null>(null);

export function ReportsDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);

  return (
    <ReportsDateContext.Provider
      value={{ selectedDate, setSelectedDate, availableDates, setAvailableDates }}
    >
      {children}
    </ReportsDateContext.Provider>
  );
}

export function useReportsDate() {
  const context = useContext(ReportsDateContext);
  if (!context) {
    throw new Error("useReportsDate must be used within a ReportsDateProvider");
  }
  return context;
}