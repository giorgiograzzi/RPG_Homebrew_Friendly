import { Component, type ReactNode } from "react";
import { strings } from "../i18n";

// Un errore di disegno non deve lasciare la pagina bianca: si vede il messaggio e si può ricaricare
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="ui-app" style={{ padding: 16 }}>
        <h2>{strings.app.errorTitle}</h2>
        <p>{this.state.error.message}</p>
        <button type="button" className="ui-btn primary" onClick={() => location.reload()}>{strings.app.reload}</button>
      </div>
    );
  }
}
