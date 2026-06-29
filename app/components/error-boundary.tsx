import { Component, createContext, useContext, useState, type ErrorInfo, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { AlertTriangle, Copy } from "lucide-react"

interface AppErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorContextValue {
  showError: (error: Error) => void
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

export function useErrorHandler() {
  const ctx = useContext(ErrorContext)
  if (!ctx) throw new Error("useErrorHandler must be used within AppErrorBoundary")
  return ctx
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, error: null }

  private static cleanup: (() => void) | null = null

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, info)
  }

  componentDidMount() {
    if (AppErrorBoundary.cleanup) return

    const onError = (event: ErrorEvent) => {
      event.preventDefault()
      this.setState({ hasError: true, error: event.error ?? new Error(event.message) })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault()
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      this.setState({ hasError: true, error: err })
    }

    const onAppError = (event: CustomEvent) => {
      this.setState({ hasError: true, error: event.detail })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    window.addEventListener("app-error", onAppError as EventListener)
    AppErrorBoundary.cleanup = () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("app-error", onAppError as EventListener)
      AppErrorBoundary.cleanup = null
    }
  }

  componentWillUnmount() {
    AppErrorBoundary.cleanup?.()
  }

  private showError = (error: Error) => {
    this.setState({ hasError: true, error })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorContext.Provider value={{ showError: this.showError }}>
          <ErrorDialog
            error={this.state.error}
            onDismiss={() => this.setState({ hasError: false, error: null })}
          />
        </ErrorContext.Provider>
      )
    }

    return (
      <ErrorContext.Provider value={{ showError: this.showError }}>
        {this.props.children}
      </ErrorContext.Provider>
    )
  }
}

function ErrorDialog({ error, onDismiss }: { error: Error; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = `${error.message}\n\n${error.stack ?? ""}`.trim()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <AlertDialog defaultOpen onOpenChange={(open) => { if (!open) onDismiss() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>حدث خطأ غير متوقع</AlertDialogTitle>
          <AlertDialogDescription className="text-right" dir="rtl">
            {error.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {import.meta.env.DEV && error.stack && (
          <pre className="bg-muted max-h-48 overflow-auto rounded p-3 text-xs" dir="ltr">
            <code>{error.stack}</code>
          </pre>
        )}
        <AlertDialogFooter>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleCopy}
          >
            <Copy className="size-3.5" />
            {copied ? "تم النسخ" : "نسخ الخطأ"}
          </button>
          <AlertDialogAction onClick={() => window.location.reload()}>
            إعادة تحميل
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
