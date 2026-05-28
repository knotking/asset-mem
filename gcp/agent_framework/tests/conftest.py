"""Ensure ``agent_framework`` imports resolve when tests run outside homecare venv."""

from __future__ import annotations

import sys
from pathlib import Path

_gcp_root = Path(__file__).resolve().parents[2]
if (_gcp_root / "agent_framework" / "__init__.py").is_file() and str(_gcp_root) not in sys.path:
    sys.path.insert(0, str(_gcp_root))
