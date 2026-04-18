export interface SshHost {
  host: string;
  port: number;
  username: string;
  key_path: string;
}

export interface PortForward {
  local_port: number;
  remote_host: string;
  remote_port: number;
}

export interface SshProfile {
  id: string;
  name: string;
  target_host: SshHost;
  bastion_host: SshHost;
  port_forwards: PortForward[];
  keepalive_interval: number;
  keepalive_count_max: number;
}

export interface ActiveConnection {
  id: string;
  profile_id: string;
  profile_name: string;
  pid: number;
}
