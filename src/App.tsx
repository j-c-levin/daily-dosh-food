import { useState } from "react";
import { useAppState } from "./lib/store";
import Onboarding from "./screens/Onboarding";
import Dashboard from "./screens/Dashboard";
import Stamps from "./screens/Stamps";
import SettingsScreen from "./screens/Settings";

type View = "dashboard" | "stamps" | "settings";

export default function App() {
  const app = useAppState();
  const [view, setView] = useState<View>("dashboard");
  if (!app.state.settings) return <Onboarding onComplete={app.completeOnboarding} />;
  if (view === "stamps") return <Stamps periods={app.state.periods} onBack={() => setView("dashboard")} />;
  if (view === "settings") return <SettingsScreen app={app} onBack={() => setView("dashboard")} />;
  return (
    <Dashboard
      app={app}
      settings={app.state.settings}
      onShowStamps={() => setView("stamps")}
      onShowSettings={() => setView("settings")}
    />
  );
}
