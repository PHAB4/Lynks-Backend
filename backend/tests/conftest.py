"""Root conftest — prevents pytest from collecting helper functions and data classes."""
import inspect

import pytest


def pytest_collection_modifyitems(config, items):
    """Skip items that look like tests but are actually helpers."""
    skip = []
    for item in items:
        # Skip TestResult dataclass (has __init__)
        if item.name == "TestResult":
            skip.append(item)
        # Skip functions named 'test' that accept parameters (helper decorators)
        if item.name == "test" and hasattr(item, "obj"):
            sig = inspect.signature(item.obj)
            if len(sig.parameters) > 0:
                skip.append(item)
    if skip:
        for item in skip:
            item.add_marker(pytest.mark.skip(reason="Helper, not a test"))
