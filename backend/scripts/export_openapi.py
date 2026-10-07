"""
Regenerate docs/openapi.json from the live FastAPI app.

Run from the backend directory after ANY change to a route, request model or
response model:

    python scripts/export_openapi.py

tests/test_api_contract.py fails when docs/openapi.json and the running app
disagree, so API changes are always visible in review and the web/extension
types (web/types, extension/src/types) get updated alongside them.
"""

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402

OUTPUT = BACKEND_DIR.parent / "docs" / "openapi.json"


def main() -> None:
    OUTPUT.write_text(
        json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
