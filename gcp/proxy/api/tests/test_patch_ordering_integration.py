from utils.message_patch_state import apply_patches_deterministically, should_apply_patch


def test_patch_ordering_keeps_latest_revision_only() -> None:
    patches = [
        {"revision": 1, "content": "one"},
        {"revision": 3, "content": "three"},
        {"revision": 2, "content": "two"},
        {"revision": 3, "content": "three-duplicate"},
        {"revision": 4, "content": "four"},
    ]
    revision, state = apply_patches_deterministically(patches, initial_revision=0)
    assert revision == 4
    assert state["content"] == "four"


def test_patch_ordering_should_apply_only_newer_revision() -> None:
    assert should_apply_patch(incoming_revision=5, stored_revision=4) is True
    assert should_apply_patch(incoming_revision=4, stored_revision=4) is False
    assert should_apply_patch(incoming_revision=3, stored_revision=4) is False
