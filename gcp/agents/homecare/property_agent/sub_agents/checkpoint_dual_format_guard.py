"""Compatibility shim — re-exports the ``checkpoint_dual_format`` package namespace."""

from __future__ import annotations

import sys

from .checkpoint_dual_format import callbacks as _callbacks
from .checkpoint_dual_format import constants as _constants
from .checkpoint_dual_format import dual_format_body as _dual_format_body

_mod = sys.modules[__name__]

for _src in (_constants, _dual_format_body, _callbacks):
    for _name in dir(_src):
        if _name.startswith("__"):
            continue
        setattr(_mod, _name, getattr(_src, _name))
