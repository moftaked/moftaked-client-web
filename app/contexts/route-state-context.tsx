import { createContext, useContext, useRef, useCallback, type ReactNode } from "react"

interface RouteState {
  selectedColumns?: Set<string>
  sortColumn?: string | null
  sortDirection?: "asc" | "desc"
  studentColumns?: string[]
  studentSortColumn?: string | null
  studentSortDirection?: "asc" | "desc"
  teacherColumns?: string[]
  teacherSortColumn?: string | null
  teacherSortDirection?: "asc" | "desc"
  studentSectionExpanded?: boolean
  teacherSectionExpanded?: boolean
}

interface RouteStateContextValue {
  saveState: (pathname: string, state: RouteState) => void
  restoreState: (pathname: string) => RouteState | null
}

const RouteStateContext = createContext<RouteStateContextValue | null>(null)

export function RouteStateProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, RouteState>())

  const saveState = useCallback((pathname: string, state: RouteState) => {
    store.current.set(pathname, state)
  }, [])

  const restoreState = useCallback((pathname: string) => {
    return store.current.get(pathname) ?? null
  }, [])

  return (
    <RouteStateContext.Provider value={{ saveState, restoreState }}>
      {children}
    </RouteStateContext.Provider>
  )
}

export function useRouteState() {
  const ctx = useContext(RouteStateContext)
  if (!ctx) throw new Error("useRouteState must be used within RouteStateProvider")
  return ctx
}
