import brandIcon from "../assets/brand-icon.svg";

export default function About() {
  return (
    <div className="page about-page">
      <div className="about-hero">
        <img src={brandIcon} alt="Bhadrakote" className="about-logo" />
        <div className="about-hero-text">
          <h1 className="about-app-name">Bhadrakote</h1>
          <span className="about-version">v0.1.0</span>
        </div>
        <p className="about-tagline">SSH Bastion — secure tunnel &amp; port-forward manager</p>
      </div>

      <div className="about-section">
        <div className="about-row">
          <span className="about-label">Author</span>
          <span className="about-value">Srinivas Gowda</span>
        </div>
        <div className="about-row">
          <span className="about-label">Email</span>
          <a href="mailto:srinivas@solancer.com" className="about-link">
            srinivas@solancer.com
          </a>
        </div>
        <div className="about-row">
          <span className="about-label">License</span>
          <span className="about-value">GNU General Public License v3.0</span>
        </div>
      </div>

      <div className="about-section about-license-block">
        <p className="about-license-text">
          This program is free software: you can redistribute it and/or modify it under the
          terms of the <strong>GNU General Public License</strong> as published by the Free
          Software Foundation, either version&nbsp;3 of the License, or (at your option) any
          later version.
        </p>
        <p className="about-license-text">
          This program is distributed in the hope that it will be useful, but{" "}
          <strong>without any warranty</strong>; without even the implied warranty of
          merchantability or fitness for a particular purpose. See the GNU General Public
          License for more details.
        </p>
      </div>
    </div>
  );
}
