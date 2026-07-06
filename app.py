from flask import Flask, request, jsonify
from flask_cors import CORS
from pipeline import run_research_pipeline
from db_utils import (
    get_history_records,
    get_saved_records,
    get_research_record,
    init_db,
    mark_research_saved,
    save_research_entry,
)

app = Flask(__name__)
CORS(app)

init_db()


@app.route("/api/research", methods=["POST"])
def research():
    data = request.get_json()
    if not data or "topic" not in data or not data["topic"].strip():
        return jsonify({"error": "Topic is required"}), 400

    topic = data["topic"].strip()

    try:
        results = run_research_pipeline(topic)
        payload = {
            "search_results": results.get("search_results", ""),
            "scraped_content": results.get("scraped_content", ""),
            "report": results.get("report", ""),
            "feedback": results.get("feedback", ""),
        }
        record_id = save_research_entry(topic, payload)
        payload["id"] = record_id
        return jsonify(payload)

    except Exception as e:
        print(f"Error executing pipeline: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/research/save-entry", methods=["POST"])
def save_entry():
    data = request.get_json() or {}
    topic = (data.get("topic") or "").strip()
    payload = data.get("payload", {}) or {}

    if not topic:
        return jsonify({"error": "Topic is required"}), 400

    record_id = save_research_entry(topic, payload)
    if record_id is None:
        return jsonify({"error": "Unable to save research entry"}), 500

    return jsonify({"id": record_id, "is_saved": False})


@app.route("/api/history", methods=["GET"])
def history():
    return jsonify(get_history_records())


@app.route("/api/saved", methods=["GET"])
def saved():
    return jsonify(get_saved_records())


@app.route("/api/save/<int:record_id>", methods=["POST"])
def save_record(record_id):
    record = get_research_record(record_id)
    if not record:
        return jsonify({"error": "Research not found"}), 404

    updated = mark_research_saved(record_id)
    return jsonify(updated)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


@app.route("/health", methods=["GET"])
def health_alias():
    return health()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

