import json
import logging
import os
from datetime import datetime
from urllib.parse import urlparse

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

load_dotenv()

logger = logging.getLogger("research_system.db")


def _get_db_config():
    config = {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "research_system"),
        "autocommit": True,
    }

    mysql_url = os.getenv("MYSQL_URL", "").strip()
    if mysql_url:
        parsed = urlparse(mysql_url)
        if parsed.hostname:
            config["host"] = parsed.hostname
        if parsed.port:
            config["port"] = parsed.port
        if parsed.username:
            config["user"] = parsed.username
        if parsed.password:
            config["password"] = parsed.password
        if parsed.path and parsed.path.lstrip("/"):
            config["database"] = parsed.path.lstrip("/")

    return config


def init_db():
    try:
        config = _get_db_config()
        base_config = {key: value for key, value in config.items() if key != "database"}
        connection = mysql.connector.connect(**base_config)
        cursor = connection.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {config['database']}")
        cursor.close()
        connection.close()

        connection = mysql.connector.connect(**config)
        cursor = connection.cursor()
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config['database']}.search_history (
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
        logger.exception("MySQL initialization failed")
        return False


def get_connection():
    config = _get_db_config()
    return mysql.connector.connect(**config)


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
    except Error:
        logger.exception("Unable to save research entry")
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
    except Error:
        logger.exception("Unable to load history")
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
    except Error:
        logger.exception("Unable to load saved records")
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
    except Error:
        logger.exception("Unable to load research record")
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
    except Error:
        logger.exception("Unable to mark research as saved")
        return None
