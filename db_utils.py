import json
import os
from datetime import datetime

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "12thcommerce"),
    "database": os.getenv("MYSQL_DATABASE", "research_system"),
    "autocommit": True,
}

COMMON_CREDENTIALS = [
    (DB_CONFIG["user"], DB_CONFIG["password"]),
    ("root", ""),
    ("root", "root"),
    ("root", "password"),
    ("admin", "admin"),
]


def _connect_without_db(credentials):
    return mysql.connector.connect(
        host=DB_CONFIG["host"],
        port=DB_CONFIG["port"],
        user=credentials[0],
        password=credentials[1],
        autocommit=True,
    )


def _connect_with_fallback():
    for credentials in COMMON_CREDENTIALS:
        try:
            connection = _connect_without_db(credentials)
            connection.close()
            DB_CONFIG["user"] = credentials[0]
            DB_CONFIG["password"] = credentials[1]
            return True
        except Error:
            continue
    return False


def init_db():
    try:
        if not _connect_with_fallback():
            print("MySQL initialization skipped: no reachable MySQL credentials were found.")
            return False

        base_config = {key: value for key, value in DB_CONFIG.items() if key != "database"}
        connection = mysql.connector.connect(**base_config)
        cursor = connection.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        cursor.close()
        connection.close()

        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {DB_CONFIG['database']}.search_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                topic TEXT NOT NULL,
                generated_report LONGTEXT NOT NULL,
                search_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_saved BOOLEAN DEFAULT FALSE
            )
            """
        )
        cursor.close()
        connection.close()
        return True
    except Error as exc:
        print(f"MySQL initialization failed: {exc}")
        return False


def get_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error:
        if _connect_with_fallback():
            return mysql.connector.connect(**DB_CONFIG)
        raise


def _serialize_row(row):
    return {
        "id": row["id"],
        "topic": row["topic"],
        "generated_report": row["generated_report"],
        "search_date": row["search_date"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(row["search_date"], datetime) else row["search_date"],
        "is_saved": bool(row["is_saved"]),
    }


def save_research_entry(topic, payload):
    try:
        serialized_payload = json.dumps(payload, ensure_ascii=False)
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO search_history (topic, generated_report, is_saved)
            VALUES (%s, %s, %s)
            """,
            (topic, serialized_payload, False),
        )
        result_id = cursor.lastrowid
        connection.commit()
        cursor.close()
        connection.close()
        return result_id
    except Error as exc:
        print(f"Unable to save research entry: {exc}")
        return None


def get_history_records():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM search_history ORDER BY search_date DESC")
        rows = cursor.fetchall()
        cursor.close()
        connection.close()
        return [_serialize_row(row) for row in rows]
    except Error as exc:
        print(f"Unable to load history: {exc}")
        return []


def get_saved_records():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM search_history WHERE is_saved = TRUE ORDER BY search_date DESC")
        rows = cursor.fetchall()
        cursor.close()
        connection.close()
        return [_serialize_row(row) for row in rows]
    except Error as exc:
        print(f"Unable to load saved records: {exc}")
        return []


def get_research_record(record_id):
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT * FROM search_history WHERE id = %s", (record_id,))
        row = cursor.fetchone()
        cursor.close()
        connection.close()
        return _serialize_row(row) if row else None
    except Error as exc:
        print(f"Unable to load research record: {exc}")
        return None


def mark_research_saved(record_id):
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("UPDATE search_history SET is_saved = TRUE WHERE id = %s", (record_id,))
        connection.commit()
        cursor.close()
        connection.close()
        return get_research_record(record_id)
    except Error as exc:
        print(f"Unable to mark research as saved: {exc}")
        return None
