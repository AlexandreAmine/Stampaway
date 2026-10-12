import { Component, type ErrorInfo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { reportError } from "@/lib/monitoring";

/**
 * Catches an error in one screen, so it shows a short message in place
 * (with "Try again" and "Back") while the tab bar and the rest of the app
 * keep working. Moving to another screen clears it. The app-wide
 * ErrorBoundary remains the last resort for errors outside screens.
 */
interface Props {
  /** The screen being shown: a new one starts without the error. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: string;
}

export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen render error:", error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ScreenError onRetry={() => this.setState({ error: null })} />;
  }
}

function ScreenError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pb-24">
      <EmptyState
        icon={AlertTriangle}
        title={t("error.screenTitle")}
        body={t("error.screenBody")}
        action={{ label: t("error.tryAgain"), onClick: onRetry }}
        secondaryAction={{ label: t("back"), onClick: goBack }}
      />
    </div>
  );
}
