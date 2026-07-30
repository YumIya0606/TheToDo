#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri_plugin_sql::{Migration, MigrationKind};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:tasks.db",
                    vec![
                        Migration {
                            version: 1,
                            description: "create tasks table",
                            sql: r#"CREATE TABLE IF NOT EXISTS tasks (
                                id TEXT PRIMARY KEY,
                                title TEXT NOT NULL,
                                description TEXT,
                                status TEXT CHECK(status IN ('todo', 'in_progress', 'completed', 'archived')) DEFAULT 'todo',
                                priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
                                category TEXT DEFAULT 'General',
                                tags TEXT,
                                completed_subtasks INTEGER DEFAULT 0,
                                total_subtasks INTEGER DEFAULT 0,
                                linked_note_id TEXT,
                                due_date TEXT,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL
                            )"#,
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 2,
                            description: "create subtasks table",
                            sql: r#"CREATE TABLE IF NOT EXISTS subtasks (
                                id TEXT PRIMARY KEY,
                                task_id TEXT NOT NULL,
                                title TEXT NOT NULL,
                                is_completed INTEGER DEFAULT 0,
                                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
                            )"#,
                            kind: MigrationKind::Up,
                        }
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}