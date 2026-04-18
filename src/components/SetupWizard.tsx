import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { SshHost, PortForward } from "../types";
import brandIcon from "../assets/brand-icon.svg";

interface Props {
  onDone: () => void;
}

const STEPS = ["Welcome", "Bastion Host", "Target Host", "Port Forwards", "Finish"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const emptyHost = (): SshHost => ({ host: "", port: 22, username: "", key_path: "" });
const emptyPF = (): PortForward => ({ local_port: 0, remote_host: "localhost", remote_port: 0 });

function HostFields({
  host,
  setField,
  hostPlaceholder,
  userPlaceholder,
  keyId,
}: {
  host: SshHost;
  setField: (f: keyof SshHost, v: string | number) => void;
  hostPlaceholder: string;
  userPlaceholder: string;
  keyId: string;
}) {
  const pickKey = async () => {
    try {
      const p = await open({ multiple: false, title: "Select SSH Private Key" });
      if (typeof p === "string") setField("key_path", p);
    } catch { /* cancelled */ }
  };

  return (
    <div className="wiz-fields">
      <div className="wiz-grid-host">
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-host`}>Host / IP</label>
          <input id={`${keyId}-host`} type="text" className="form-input"
            value={host.host} onChange={e => setField("host", e.target.value)}
            placeholder={hostPlaceholder} autoComplete="off" />
        </div>
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-port`}>Port</label>
          <input id={`${keyId}-port`} type="number" className="form-input"
            value={host.port} onChange={e => setField("port", parseInt(e.target.value) || 22)}
            min={1} max={65535} />
        </div>
      </div>
      <div className="wiz-grid">
        <div className="form-field">
          <label className="field-label" htmlFor={`${keyId}-user`}>Username</label>
          <input id={`${keyId}-user`} type="text" className="form-input"
            value={host.username} onChange={e => setField("username", e.target.value)}
            placeholder={userPlaceholder} autoComplete="off" />
        </div>
        <div className="form-field">
          <label className="field-label">Private Key <span className="wiz-optional">(optional)</span></label>
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

export default function SetupWizard({ onDone }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [bastion, setBastion] = useState<SshHost>(emptyHost());
  const [target, setTarget] = useState<SshHost>(emptyHost());
  const [pfs, setPfs] = useState<PortForward[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBField = (f: keyof SshHost, v: string | number) =>
    setBastion(s => ({ ...s, [f]: v }));
  const setTField = (f: keyof SshHost, v: string | number) =>
    setTarget(s => ({ ...s, [f]: v }));

  const addPF = () => setPfs(s => [...s, emptyPF()]);
  const setPF = (i: number, f: keyof PortForward, v: string | number) =>
    setPfs(s => { const a = [...s]; a[i] = { ...a[i], [f]: v }; return a; });
  const removePF = (i: number) =>
    setPfs(s => s.filter((_, idx) => idx !== i));

  const dismiss = () => {
    localStorage.setItem("bhadrakote_onboarded", "1");
    onDone();
  };

  const handleFinish = async () => {
    setError(null);
    setSaving(true);
    try {
      await invoke("save_profile", {
        profile: {
          id: "",
          name: name.trim() || "My First Profile",
          bastion_host: bastion,
          target_host: target,
          port_forwards: pfs,
          keepalive_interval: 60,
          keepalive_count_max: 3,
        },
      });
      dismiss();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const canAdvanceStep1 = bastion.host.trim() !== "" && bastion.username.trim() !== "";
  const canAdvanceStep2 = target.host.trim() !== "" && target.username.trim() !== "";

  return (
    <div className="wiz-backdrop">
      <div className="wiz-modal">

        {/* Header */}
        <div className="wiz-header">
          <div className="wiz-steps">
            {STEPS.map((label, i) => (
              <div key={i} className={`wiz-step ${i === step ? "active" : i < step ? "done" : ""}`}>
                <div className="wiz-step-dot">
                  {i < step ? <span>&#10003;</span> : <span>{i + 1}</span>}
                </div>
                <span className="wiz-step-label">{label}</span>
                {i < STEPS.length - 1 && <div className="wiz-step-line" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="wiz-body">

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="wiz-welcome">
              <img src={brandIcon} alt="Bhadrakote" className="wiz-logo" />
              <h2 className="wiz-title">Welcome to Bhadrakote</h2>
              <p className="wiz-desc">
                Your SSH Bastion manager — securely tunnel through jump servers and forward
                ports to private hosts with zero configuration overhead.
              </p>
              <div className="wiz-feature-list">
                <div className="wiz-feature">
                  <span className="wiz-feature-icon">&#9783;</span>
                  <div>
                    <strong>Bastion profiles</strong>
                    <p>Save jump-server + target-host pairs for one-click connections.</p>
                  </div>
                </div>
                <div className="wiz-feature">
                  <span className="wiz-feature-icon">&#8644;</span>
                  <div>
                    <strong>Port forwarding</strong>
                    <p>Forward remote database, API, or service ports to localhost.</p>
                  </div>
                </div>
                <div className="wiz-feature">
                  <span className="wiz-feature-icon">&#9883;</span>
                  <div>
                    <strong>Live connections</strong>
                    <p>Monitor and disconnect active tunnels from one place.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Bastion Host */}
          {step === 1 && (
            <div className="wiz-step-body">
              <div className="wiz-step-icon">&#128274;</div>
              <h2 className="wiz-title">Jump Server</h2>
              <p className="wiz-desc">
                The bastion host is the publicly reachable server you SSH through to access
                private infrastructure.
              </p>
              <HostFields host={bastion} setField={setBField}
                hostPlaceholder="bastion.example.com" userPlaceholder="ec2-user" keyId="wiz-bastion" />
            </div>
          )}

          {/* Step 2 — Target Host */}
          {step === 2 && (
            <div className="wiz-step-body">
              <div className="wiz-step-icon">&#128187;</div>
              <h2 className="wiz-title">Target Host</h2>
              <p className="wiz-desc">
                The private server you want to reach via the bastion. This host is only
                accessible through the jump server.
              </p>
              <HostFields host={target} setField={setTField}
                hostPlaceholder="10.0.1.100" userPlaceholder="ubuntu" keyId="wiz-target" />
            </div>
          )}

          {/* Step 3 — Port Forwards */}
          {step === 3 && (
            <div className="wiz-step-body">
              <div className="wiz-step-icon">&#8644;</div>
              <h2 className="wiz-title">Port Forwards</h2>
              <p className="wiz-desc">
                Optionally map remote ports on the target to your local machine. You can
                skip this and add tunnels later.
              </p>
              <div className="pf-list">
                {pfs.map((pf, i) => (
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
              <button type="button" className="btn-add-tunnel" onClick={addPF}>
                + Add Tunnel
              </button>
            </div>
          )}

          {/* Step 4 — Finish */}
          {step === 4 && (
            <div className="wiz-step-body wiz-finish">
              <div className="wiz-step-icon">&#127881;</div>
              <h2 className="wiz-title">Name your profile</h2>
              <p className="wiz-desc">
                Give this connection a memorable name. You can create more profiles
                from the sidebar at any time.
              </p>
              <div className="form-field wiz-name-field">
                <label className="field-label" htmlFor="wiz-name">Profile name</label>
                <input id="wiz-name" type="text" className="form-input"
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Production Database" autoFocus />
              </div>
              <div className="wiz-summary">
                <div className="wiz-summary-row">
                  <span className="wiz-summary-label">Bastion</span>
                  <span className="wiz-summary-val">
                    {bastion.username}@{bastion.host}:{bastion.port}
                  </span>
                </div>
                <div className="wiz-summary-row">
                  <span className="wiz-summary-label">Target</span>
                  <span className="wiz-summary-val">
                    {target.username}@{target.host}:{target.port}
                  </span>
                </div>
                {pfs.length > 0 && (
                  <div className="wiz-summary-row">
                    <span className="wiz-summary-label">Tunnels</span>
                    <span className="wiz-summary-val">{pfs.length} configured</span>
                  </div>
                )}
              </div>
              {error && (
                <div className="alert alert-error" style={{ marginTop: 14 }}>
                  <span className="alert-icon">&#9888;</span>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wiz-footer">
          <button className="btn btn-ghost" onClick={dismiss}>
            Skip setup
          </button>
          <div className="wiz-footer-right">
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(s => (s - 1) as Step)}>
                Back
              </button>
            )}
            {step < 4 && (
              <button
                className="btn btn-primary"
                onClick={() => setStep(s => (s + 1) as Step)}
                disabled={
                  (step === 1 && !canAdvanceStep1) ||
                  (step === 2 && !canAdvanceStep2)
                }
              >
                {step === 0 ? "Get Started" : "Next"}
              </button>
            )}
            {step === 4 && (
              <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
                {saving ? "Creating…" : "Create Profile"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
