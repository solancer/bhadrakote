import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { SshProfile, SshHost, PortForward } from "../types";

interface Props {
  profile: SshProfile | null;
  onSave: () => void;
  onCancel: () => void;
}

const emptyHost = (): SshHost => ({ host: "", port: 22, username: "", key_path: "" });
const emptyPF   = (): PortForward => ({ local_port: 0, remote_host: "localhost", remote_port: 0 });

const blank = (): SshProfile => ({
  id: "",
  name: "",
  target_host: emptyHost(),
  bastion_host: emptyHost(),
  port_forwards: [],
  keepalive_interval: 60,
  keepalive_count_max: 3,
});

interface HostSectionProps {
  label: string;
  host: SshHost;
  setField: (f: keyof SshHost, v: string | number) => void;
  hostPlaceholder: string;
  userPlaceholder: string;
  keyId: string;
}

function HostSection({ label, host, setField, hostPlaceholder, userPlaceholder, keyId }: HostSectionProps) {
  const pickKey = async () => {
    try {
      const p = await open({ multiple: false, title: "Select SSH Private Key" });
      if (typeof p === "string") setField("key_path", p);
    } catch { /* cancelled */ }
  };

  return (
    <div className="form-section">
      <span className="section-label">{label}</span>
      <div className="form-grid-host" style={{ marginBottom: 14 }}>
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-host`}>Host</label>
          <input id={`${keyId}-host`} type="text" className="form-input"
            value={host.host} onChange={e => setField("host", e.target.value)}
            placeholder={hostPlaceholder} required />
        </div>
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-port`}>Port</label>
          <input id={`${keyId}-port`} type="number" className="form-input"
            value={host.port} onChange={e => setField("port", parseInt(e.target.value) || 22)}
            min={1} max={65535} />
        </div>
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-user`}>Username</label>
          <input id={`${keyId}-user`} type="text" className="form-input"
            value={host.username} onChange={e => setField("username", e.target.value)}
            placeholder={userPlaceholder} required />
        </div>
        <div className="form-field">
          <label className="field-label">Private Key (optional)</label>
          <div className="input-row">
            <input type="text" className="form-input"
              value={host.key_path} onChange={e => setField("key_path", e.target.value)}
              placeholder="~/.ssh/id_rsa" />
            <button type="button" className="btn-browse" onClick={pickKey} title="Browse">
              &#128193;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileForm({ profile, onSave, onCancel }: Props) {
  const [form, setForm] = useState<SshProfile>(profile ? { ...profile } : blank());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setTarget  = (f: keyof SshHost, v: string | number) =>
    setForm(s => ({ ...s, target_host:  { ...s.target_host,  [f]: v } }));
  const setBastion = (f: keyof SshHost, v: string | number) =>
    setForm(s => ({ ...s, bastion_host: { ...s.bastion_host, [f]: v } }));

  const addPF = () =>
    setForm(s => ({ ...s, port_forwards: [...s.port_forwards, emptyPF()] }));
  const setPF = (i: number, f: keyof PortForward, v: string | number) =>
    setForm(s => {
      const pfs = [...s.port_forwards];
      pfs[i] = { ...pfs[i], [f]: v };
      return { ...s, port_forwards: pfs };
    });
  const removePF = (i: number) =>
    setForm(s => ({ ...s, port_forwards: s.port_forwards.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await invoke("save_profile", { profile: form });
      onSave();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{profile ? "Edit Profile" : "New Profile"}</div>
          <div className="page-sub">Configure SSH bastion connection</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">&#9888;</span>
          {error}
        </div>
      )}

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <span className="section-label">Profile</span>
          <div className="form-field">
            <label className="field-label" htmlFor="pf-name">Name</label>
            <input id="pf-name" type="text" className="form-input"
              value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              placeholder="Production Database" required />
          </div>
        </div>

        <HostSection label="Bastion Host (Jump Server)" host={form.bastion_host}
          setField={setBastion} hostPlaceholder="bastion.example.com"
          userPlaceholder="ec2-user" keyId="bastion" />

        <HostSection label="Target Host" host={form.target_host}
          setField={setTarget} hostPlaceholder="10.0.1.100"
          userPlaceholder="ubuntu" keyId="target" />

        <div className="form-section">
          <span className="section-label">Port Forwards</span>
          {form.port_forwards.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              No tunnels configured.
            </p>
          ) : (
            <div className="pf-list">
              {form.port_forwards.map((pf, i) => (
                <div key={i} className="pf-row">
                  <div className="pf-field">
                    <span>Local Port</span>
                    <input type="number" className="form-input pf-port"
                      value={pf.local_port || ""} placeholder="5432"
                      onChange={e => setPF(i, "local_port", parseInt(e.target.value) || 0)}
                      min={1} max={65535} />
                  </div>
                  <span className="pf-sep">→</span>
                  <div className="pf-field pf-field-grow">
                    <span>Remote Host</span>
                    <input type="text" className="form-input"
                      value={pf.remote_host} placeholder="localhost"
                      onChange={e => setPF(i, "remote_host", e.target.value)} />
                  </div>
                  <span className="pf-sep">:</span>
                  <div className="pf-field">
                    <span>Remote Port</span>
                    <input type="number" className="form-input pf-port"
                      value={pf.remote_port || ""} placeholder="5432"
                      onChange={e => setPF(i, "remote_port", parseInt(e.target.value) || 0)}
                      min={1} max={65535} />
                  </div>
                  <button type="button" className="btn btn-ghost"
                    onClick={() => removePF(i)}
                    style={{ color: "var(--danger)", paddingBottom: 7 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn-add-tunnel" onClick={addPF}>
            + Add Tunnel
          </button>
        </div>

        <div className="form-section">
          <span className="section-label">Keepalive</span>
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">Interval (seconds)</label>
              <input type="number" className="form-input"
                value={form.keepalive_interval}
                onChange={e => setForm(s => ({ ...s, keepalive_interval: parseInt(e.target.value) || 0 }))}
                min={0} />
            </div>
            <div className="form-field">
              <label className="field-label">Max Retries</label>
              <input type="number" className="form-input"
                value={form.keepalive_count_max}
                onChange={e => setForm(s => ({ ...s, keepalive_count_max: parseInt(e.target.value) || 1 }))}
                min={1} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
