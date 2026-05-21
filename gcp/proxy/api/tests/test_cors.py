from core.cors import DEFAULT_CORS_ORIGINS, parse_cors_origins


def test_default_includes_asset_mem_and_homegeek():
    origins = parse_cors_origins("")
    assert "https://asset-mem.com" in origins
    assert "https://www.asset-mem.com" in origins
    assert "https://homegeek.ai" in origins
    assert origins == list(DEFAULT_CORS_ORIGINS)


def test_normalize_strips_trailing_slash():
    origins = parse_cors_origins("https://asset-mem.com/,https://example.com/path")
    assert origins == ["https://asset-mem.com", "https://example.com"]


def test_env_override_replaces_defaults(monkeypatch):
    monkeypatch.setenv("PROXY_CORS_ORIGINS", "https://only.example.com")
    assert parse_cors_origins() == ["https://only.example.com"]
