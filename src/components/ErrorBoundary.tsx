import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last-resort crash screen. Without this, any render-time exception unmounts
 * the whole tree and leaves a blank white screen with no way out.
 *
 * Deliberately self-contained: it reads the language straight from
 * localStorage and carries its own copy rather than using LanguageContext,
 * because a boundary must still render when the thing that broke is a
 * provider above it.
 */

type Language = "en" | "fr" | "es" | "it" | "pt" | "nl";

const COPY: Record<Language, { title: string; body: string; action: string }> = {
  en: {
    title: "Something went wrong",
    body: "The app ran into an unexpected error. Restarting usually fixes it.",
    action: "Restart app",
  },
  fr: {
    title: "Une erreur est survenue",
    body: "L'application a rencontré une erreur inattendue. Redémarrer résout généralement le problème.",
    action: "Redémarrer l'application",
  },
  es: {
    title: "Algo salió mal",
    body: "La aplicación encontró un error inesperado. Reiniciar suele solucionarlo.",
    action: "Reiniciar la aplicación",
  },
  it: {
    title: "Qualcosa è andato storto",
    body: "L'app ha riscontrato un errore imprevisto. Riavviare di solito risolve il problema.",
    action: "Riavvia l'app",
  },
  pt: {
    title: "Algo deu errado",
    body: "O aplicativo encontrou um erro inesperado. Reiniciar costuma resolver.",
    action: "Reiniciar o aplicativo",
  },
  nl: {
    title: "Er is iets misgegaan",
    body: "De app liep tegen een onverwachte fout aan. Opnieuw starten lost dit meestal op.",
    action: "App opnieuw starten",
  },
};

function currentLanguage(): Language {
  try {
    const stored = localStorage.getItem("app_language");
    if (stored && stored in COPY) return stored as Language;
  } catch {
    // localStorage can throw when site data is blocked
  }
  return "en";
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // There is no crash reporting yet, so this console entry and the message
    // shown on screen are the only record of what happened.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const copy = COPY[currentLanguage()];

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">{copy.body}</p>
        <button
          type="button"
          onClick={() => window.location.replace("/")}
          className="mt-8 w-full max-w-xs rounded-xl bg-primary py-3.5 font-medium text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {copy.action}
        </button>
        {error.message && (
          <p className="mt-6 max-w-xs break-words font-mono text-[11px] text-muted-foreground/60">
            {error.message}
          </p>
        )}
      </div>
    );
  }
}
