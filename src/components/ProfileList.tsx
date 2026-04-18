import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { SshProfile } from "../types";

interface Props {
  onNewProfile: () => void;
  onEditProfile: (profile: SshProfile) => void;
}

const AV_COUNT = 5;

function avatarClass(name: string) {
  return `av-${name.charCodeAt(0) % AV_COUNT}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

export default function ProfileList({ onNewProfile, onEditProfile }: Props) {
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    try {
      setProfiles(await invoke<SshProfile[]>("get_profiles"));
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profile?")) return;
    try {
      await invoke("delete_profile", { id });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleConnect = async (profile: SshProfile) => {
    setConnecting(profile.id);
    setError(null);
    setSuccess(null);
    try {
      await invoke("connect", { profileId: profile.id });
      setConnected((s) => new Set(s).add(profile.id));
      setSuccess(`Tunnel started for "${profile.name}". Check Active Connections.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">SSH Profiles</div>
          <div className="page-sub">
            {profiles.length === 0
              ? "No profiles yet"
              : `${profiles.length} profile${profiles.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onNewProfile}>
          + New Profile
        </button>
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError(null)}>
          <span className="alert-icon">&#9888;</span>
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" onClick={() => setSuccess(null)}>
          <span className="alert-icon">&#10003;</span>
          {success}
        </div>
      )}

      {profiles.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">&#9881;</span>
          <div className="empty-title">No profiles yet</div>
          <p className="empty-hint">
            Create a profile to configure your SSH bastion connection with port
            tunnels and keepalive settings.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={onNewProfile}
          >
            + New Profile
          </button>
        </div>
      ) : (
        <div className="profile-list-wrap">
          <div className="profile-list">
            {profiles.map((profile) => (
              <div key={profile.id} className="profile-row">
                <div
                  className={`profile-avatar ${avatarClass(profile.name)}`}
                >
                  {initials(profile.name)}
                </div>

                <div className="profile-info">
                  <div className="profile-name">
                    {profile.name}
                    {connected.has(profile.id) && (
                      <span className="connected-pill">connected</span>
                    )}
                  </div>
                  <div className="profile-hosts">
                    <span className="host-chip">
                      <span className="host-chip-label">Target</span>
                      {profile.target_host.username}@{profile.target_host.host}:{profile.target_host.port}
                    </span>
                    <span style={{ color: "var(--border-hover)" }}>•</span>
                    <span className="host-chip">
                      <span className="host-chip-label">Via</span>
                      {profile.bastion_host.username}@{profile.bastion_host.host}:{profile.bastion_host.port}
                    </span>
                  </div>
                  {profile.port_forwards.length > 0 && (
                    <div className="profile-tunnels">
                      {profile.port_forwards.map((pf, i) => (
                        <span key={i} className="tunnel-badge">
                          {pf.local_port}&nbsp;→&nbsp;{pf.remote_host}:{pf.remote_port}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="profile-actions">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleConnect(profile)}
                    disabled={connecting === profile.id}
                  >
                    {connecting === profile.id ? "Starting…" : "Connect"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEditProfile(profile)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(profile.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
