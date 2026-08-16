import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs_assistant.db")


def get_db_connection():
    """Create a database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create tables if they do not exist"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cv_text TEXT NOT NULL,
            job_description TEXT NOT NULL,
            match_score INTEGER NOT NULL,
            result TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            cv_text TEXT NOT NULL,
            query TEXT,
            location TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    print("[Database] Initialized successfully.")


def save_analysis(cv_text: str, job_description: str, match_score: int, result: str) -> int:
    """Save an analysis record and return the generated ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO history (cv_text, job_description, match_score, result, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (cv_text, job_description, match_score, result, created_at))
    conn.commit()
    last_row_id = cursor.lastrowid
    conn.close()
    return last_row_id


def get_all_history() -> list:
    """Fetch all history records sorted by date descending"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM history ORDER BY id DESC")
    rows = cursor.fetchall()
    
    history_list = []
    for row in rows:
        history_list.append({
            "id": row["id"],
            "cv_text": row["cv_text"],
            "job_description": row["job_description"],
            "match_score": row["match_score"],
            "result": row["result"],
            "created_at": row["created_at"]
        })
    conn.close()
    return history_list


def delete_history_item(item_id: int) -> bool:
    """Delete a history item by ID. Returns True if successful"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE id = ?", (item_id,))
    conn.commit()
    changes = conn.total_changes
    conn.close()
    return changes > 0


def subscribe_user(email: str, cv_text: str, query: str = "", location: str = "") -> bool:
    """Subscribe a user for email notifications. Updates if already subscribed."""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        cursor.execute("""
            INSERT INTO subscriptions (email, cv_text, query, location, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                cv_text = excluded.cv_text,
                query = excluded.query,
                location = excluded.location
        """, (email.strip().lower(), cv_text, query, location, created_at))
        conn.commit()
        success = True
    except Exception as e:
        print(f"[Database Error] Subscription failed: {e}")
        success = False
    finally:
        conn.close()
    return success


def get_all_subscriptions() -> list:
    """Fetch all active subscriptions"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subscriptions")
    rows = cursor.fetchall()
    
    subs = []
    for row in rows:
        subs.append({
            "id": row["id"],
            "email": row["email"],
            "cv_text": row["cv_text"],
            "query": row["query"],
            "location": row["location"],
            "created_at": row["created_at"]
        })
    conn.close()
    return subs


def unsubscribe_user(email: str) -> bool:
    """Remove user subscription"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM subscriptions WHERE email = ?", (email.strip().lower(),))
    conn.commit()
    changes = conn.total_changes
    conn.close()
    return changes > 0

