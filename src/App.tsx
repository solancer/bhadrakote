import { useState } from "react";
import ProfileList from "./components/ProfileList";
import ProfileForm from "./components/ProfileForm";
import ActiveConnections from "./components/ActiveConnections";
import About from "./components/About";
import SetupWizard from "./components/SetupWizard";
import { SshProfile } from "./types";
import brandIcon from "./assets/brand-icon.svg";

type View = "profiles" | "form" | "connections" | "about";

export default function App() {
  const [view, setView] = useState<View>("profiles");
  const [editing, setEditing] = useState<SshProfile | null>(null);
  const [connCount, setConnCount] = useState(0);
  const [showWizard, setShowWizard] = useState(
    () => !localStorage.getItem("bhadrakote_onboarded")
  );

  const goToForm = (profile: SshProfile | null = null) => {
    setEditing(profile);
    setView("form");
  };

  const goToProfiles = () => {
    setEditing(null);
    setView("profiles");
  };

  const isProfilesActive = view === "profiles" || view === "form";

  return (
    <div className="app">
      {showWizard && <SetupWizard onDone={() => setShowWizard(false)} />}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <img src={brandIcon} alt="Bhadrakote" />
          </div>
          <div className="brand-text">
            <div className="brand-name">Bhadrakote</div>
            <div className="brand-sub">SSH Bastion</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item-row">
            <button
              className={`nav-item${isProfilesActive ? " active" : ""}`}
              onClick={goToProfiles}
            >
              <span className="nav-icon">&#9783;</span>
              Profiles
            </button>
            <button
              className="nav-action"
              onClick={() => goToForm(null)}
              title="New Profile"
            >
              +
            </button>
          </div>

          <div className="nav-item-row">
            <button
              className={`nav-item${view === "connections" ? " active" : ""}`}
              onClick={() => setView("connections")}
            >
              <span className="nav-icon">&#9883;</span>
              Connections
              {connCount > 0 && (
                <span className="nav-badge">{connCount}</span>
              )}
            </button>
          </div>
        </nav>

        <div className="sidebar-footer-nav">
          <button
            className={`nav-item nav-item-footer${view === "about" ? " active" : ""}`}
            onClick={() => setView("about")}
          >
            <span className="nav-icon">&#9432;</span>
            About
          </button>
        </div>
      </aside>

      <main className="main-content">
        {view === "profiles" && (
          <ProfileList
            onNewProfile={() => goToForm(null)}
            onEditProfile={(p) => goToForm(p)}
          />
        )}
        {view === "form" && (
          <ProfileForm
            profile={editing}
            onSave={goToProfiles}
            onCancel={goToProfiles}
          />
        )}
        {view === "connections" && (
          <ActiveConnections onCountChange={setConnCount} />
        )}
        {view === "about" && <About />}
      </main>
    </div>
  );
}
