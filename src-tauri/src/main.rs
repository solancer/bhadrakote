// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SshHost {
    host: String,
    port: u16,
    username: String,
    key_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PortForward {
    local_port: u16,
    remote_host: String,
    remote_port: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SshProfile {
    id: String,
    name: String,
    target_host: SshHost,
    bastion_host: SshHost,
    port_forwards: Vec<PortForward>,
    keepalive_interval: u32,
    keepalive_count_max: u32,
}

#[derive(Debug, Serialize)]
struct ActiveConnection {
    id: String,
    profile_id: String,
    profile_name: String,
    pid: u32,
}

struct ConnectionEntry {
    child: Child,
    profile_id: String,
    profile_name: String,
}

struct AppState {
    connections: HashMap<String, ConnectionEntry>,
}

type StateMutex = Mutex<AppState>;

fn profiles_path(app: &AppHandle) -> PathBuf {
    let dir = app
        .path_resolver()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("profiles.json")
}

fn read_profiles(app: &AppHandle) -> Vec<SshProfile> {
    fs::read_to_string(profiles_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_profiles(app: &AppHandle, profiles: &[SshProfile]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    fs::write(profiles_path(app), json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_profiles(app_handle: AppHandle) -> Vec<SshProfile> {
    read_profiles(&app_handle)
}

#[tauri::command]
fn save_profile(app_handle: AppHandle, mut profile: SshProfile) -> Result<(), String> {
    if profile.id.is_empty() {
        profile.id = Uuid::new_v4().to_string();
    }
    let mut profiles = read_profiles(&app_handle);
    if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }
    write_profiles(&app_handle, &profiles)
}

#[tauri::command]
fn delete_profile(app_handle: AppHandle, id: String) -> Result<(), String> {
    let mut profiles = read_profiles(&app_handle);
    profiles.retain(|p| p.id != id);
    write_profiles(&app_handle, &profiles)
}

#[tauri::command]
fn connect(
    app_handle: AppHandle,
    state: State<StateMutex>,
    profile_id: String,
) -> Result<String, String> {
    let profiles = read_profiles(&app_handle);
    let profile = profiles
        .iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?
        .clone();

    let mut args: Vec<String> = vec![
        "-N".into(),
        "-o".into(), "StrictHostKeyChecking=accept-new".into(),
        "-o".into(), format!("ServerAliveInterval={}", profile.keepalive_interval),
        "-o".into(), format!("ServerAliveCountMax={}", profile.keepalive_count_max),
        "-J".into(),
        format!(
            "{}@{}:{}",
            profile.bastion_host.username,
            profile.bastion_host.host,
            profile.bastion_host.port
        ),
    ];

    if !profile.bastion_host.key_path.is_empty() {
        args.push("-i".into());
        args.push(profile.bastion_host.key_path.clone());
    }
    if !profile.target_host.key_path.is_empty() {
        args.push("-i".into());
        args.push(profile.target_host.key_path.clone());
    }

    for pf in &profile.port_forwards {
        args.push("-L".into());
        args.push(format!(
            "{}:{}:{}",
            pf.local_port, pf.remote_host, pf.remote_port
        ));
    }

    args.push("-p".into());
    args.push(profile.target_host.port.to_string());
    args.push(format!("{}@{}", profile.target_host.username, profile.target_host.host));

    let child = Command::new("ssh")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start SSH: {}", e))?;

    let connection_id = Uuid::new_v4().to_string();
    let mut state = state.lock().map_err(|_| "State lock poisoned".to_string())?;
    state.connections.insert(
        connection_id.clone(),
        ConnectionEntry {
            child,
            profile_id: profile.id,
            profile_name: profile.name,
        },
    );

    Ok(connection_id)
}

#[tauri::command]
fn disconnect(state: State<StateMutex>, connection_id: String) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "State lock poisoned".to_string())?;
    if let Some(mut entry) = state.connections.remove(&connection_id) {
        entry.child.kill().map_err(|e| format!("Failed to kill: {}", e))?;
    } else {
        return Err("Connection not found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_active_connections(state: State<StateMutex>) -> Result<Vec<ActiveConnection>, String> {
    let mut state = state.lock().map_err(|_| "State lock poisoned".to_string())?;

    let dead: Vec<String> = state
        .connections
        .iter_mut()
        .filter_map(|(id, e)| e.child.try_wait().ok().flatten().map(|_| id.clone()))
        .collect();
    for id in dead {
        state.connections.remove(&id);
    }

    Ok(state
        .connections
        .iter()
        .map(|(id, e)| ActiveConnection {
            id: id.clone(),
            profile_id: e.profile_id.clone(),
            profile_name: e.profile_name.clone(),
            pid: e.child.id(),
        })
        .collect())
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState {
            connections: HashMap::new(),
        }))
        .invoke_handler(tauri::generate_handler![
            get_profiles,
            save_profile,
            delete_profile,
            connect,
            disconnect,
            get_active_connections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
