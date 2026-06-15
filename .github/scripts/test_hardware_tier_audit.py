#!/usr/bin/env python3
"""Unit tests for hardware tier audit parsing."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "hardware_tier.py"
spec = importlib.util.spec_from_file_location("hardware_tier", SCRIPT)
hardware_tier = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["hardware_tier"] = hardware_tier
spec.loader.exec_module(hardware_tier)


KNATIVE_PROXY_DESCRIBE = {
    "apiVersion": "serving.knative.dev/v1",
    "kind": "Service",
    "spec": {
        "template": {
            "metadata": {
                "annotations": {
                    "autoscaling.knative.dev/minScale": "0",
                    "autoscaling.knative.dev/maxScale": "2",
                }
            },
            "spec": {
                "containerConcurrency": 80,
                "timeoutSeconds": 300,
                "containers": [
                    {
                        "resources": {
                            "limits": {"cpu": "1000m", "memory": "512Mi"},
                        }
                    }
                ],
            },
        }
    },
}

CLOUD_RUN_V2_PROXY_DESCRIBE = {
    "template": {
        "scaling": {"minInstanceCount": 0, "maxInstanceCount": 2},
        "maxInstanceRequestConcurrency": 80,
        "timeout": "300s",
        "containers": [
            {
                "resources": {
                    "limits": {"cpu": "1", "memory": "512Mi"},
                }
            }
        ],
    }
}


class HardwareTierAuditTests(unittest.TestCase):
    def test_parse_knative_proxy_describe(self) -> None:
        live = hardware_tier._parse_proxy_from_describe(KNATIVE_PROXY_DESCRIBE)
        self.assertNotIn("error", live)
        self.assertEqual(live["memory"], "512Mi")
        self.assertEqual(live["cpu"], "1000m")
        self.assertEqual(live["min_instances"], "0")
        self.assertEqual(live["max_instances"], "2")
        self.assertEqual(live["concurrency"], 80)
        self.assertEqual(live["timeout_seconds"], 300)

    def test_parse_cloud_run_v2_proxy_describe(self) -> None:
        live = hardware_tier._parse_proxy_from_describe(CLOUD_RUN_V2_PROXY_DESCRIBE)
        self.assertNotIn("error", live)
        self.assertEqual(live["max_instances"], 2)
        self.assertEqual(live["timeout_seconds"], 300)

    def test_cpu_normalization(self) -> None:
        mismatches: list[str] = []
        hardware_tier._compare_field("proxy.cpu", "1", "1000m", mismatches)
        self.assertEqual(mismatches, [])


if __name__ == "__main__":
    unittest.main()
