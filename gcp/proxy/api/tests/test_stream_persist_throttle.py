from unittest.mock import patch

from services.stream_persist_throttle import StreamPersistThrottle


def test_throttle_limits_rapid_persists():
    throttle = StreamPersistThrottle(interval_ms=200)
    monotonic = [1000.0]

    def fake_monotonic():
        return monotonic[0]

    with patch("services.stream_persist_throttle.time.monotonic", side_effect=fake_monotonic):
        assert throttle.should_persist() is True
        monotonic[0] += 0.05
        assert throttle.should_persist() is False
        monotonic[0] += 0.05
        assert throttle.should_persist() is False
        monotonic[0] += 0.15
        assert throttle.should_persist() is True


def test_finalize_always_persists():
    throttle = StreamPersistThrottle(interval_ms=10_000)
    with patch("services.stream_persist_throttle.time.monotonic", return_value=1.0):
        assert throttle.should_persist() is True
        assert throttle.should_persist() is False
        assert throttle.should_persist(finalize=True) is True


def test_first_persist_always_allowed():
    throttle = StreamPersistThrottle(interval_ms=200)
    with patch("services.stream_persist_throttle.time.monotonic", return_value=500.0):
        assert throttle.should_persist() is True
