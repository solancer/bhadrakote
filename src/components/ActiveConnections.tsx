import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { ActiveConnection } from "../types";

interface Props {
  onCountChange?: (count: number) => void;
}

export default function ActiveConnections({ onCountChange }: Props) {
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await invoke<ActiveConnection[]>("get_active_connections");
      setConnections(data);
      onCountChange?.(data.length);
    } catch (e) {
      setError(String(e));
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const handleDisconnect = async (id: string) => {
    try {
      await invoke("disconnect", { connectionId: id });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Active Connections</div>
          <div className="page-sub">
            {connections.length === 0
              ? "No active tunnels"
              : `${connections.length} tunnel${connections.length !== 1 ? "s" : ""} running`}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError(null)}>
          <span className="alert-icon">&#9888;</span>
          {error}
        </div>
      )}

      {connections.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">&#128279;</span>
          <div className="empty-title">No active connections</div>
          <p className="empty-hint">
            Go to Profiles and click Connect to start an SSH tunnel through your
            bastion host.
          </p>
        </div>
      ) : (
        <div className="conn-list">
          {connections.map((conn) => (
            <div key={conn.id} className="conn-card">
              <div className="conn-dot" />
              <div className="conn-info">
                <div className="conn-name">{conn.profile_name}</div>
                <div className="conn-meta">PID {conn.pid}</div>
              </div>
              <span className="conn-status-label">Active</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDisconnect(conn.id)}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
