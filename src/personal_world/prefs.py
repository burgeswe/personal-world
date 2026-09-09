"""Presentation preference state: the accessibility contract.

Every preference carries a default that satisfies the owner's
accessibility floor, a closed set of allowed values (only >= floor),
and the floor itself. Values below the floor are rejected, never
silently clamped. Application is native construction: the server
renders preferences into CSS custom properties and data-* attributes
so the dashboard honors them with JavaScript disabled.
"""

import json
from dataclasses import dataclass
from typing import Any

TARGET_SIZE_FLOOR = 44
"""Interactive targets >= 44x44 CSS px (WCAG 2.5.5 + Apple HIG)."""

MOTION_FLOOR = "reduced"
CONTRAST_FLOOR = "comfortable"
TEXT_SCALE_FLOOR = 1.0
DENSITY_FLOOR = "compact"


class PrefsValueError(ValueError):
    """Preference value below the accessibility floor or outside the
    allowed vocabulary."""


@dataclass(frozen=True)
class EnumPref:
    key: str
    default: str
    allowed: tuple[str, ...]
    floor: str
    css_var: str
    data_attr: str

    def validate(self, value: Any) -> str:
        if isinstance(value, bool) or not isinstance(value, str):
            raise PrefsValueError(
                f"{self.key}: expected one of {list(self.allowed)}, "
                f"got {value!r}"
            )
        if value not in self.allowed:
            raise PrefsValueError(
                f"{self.key}: {value!r} is not an allowed value "
                f"(allowed: {list(self.allowed)})"
            )
        if self.allowed.index(value) < self.allowed.index(self.floor):
            raise PrefsValueError(
                f"{self.key}: {value!r} is below the accessibility floor "
                f"({self.floor!r})"
            )
        return value


@dataclass(frozen=True)
class NumberPref:
    key: str
    default: float
    floor: float
    css_var: str
    data_attr: str
    allowed: tuple[float, ...] | None = None
    integer: bool = False
    unit: str = ""

    def validate(self, value: Any) -> float | int:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise PrefsValueError(
                f"{self.key}: expected a number, got {value!r}"
            )
        num = float(value)
        if num < self.floor:
            raise PrefsValueError(
                f"{self.key}: {value!r} is below the accessibility floor "
                f"({self.floor:g})"
            )
        if self.allowed is not None and num not in self.allowed:
            raise PrefsValueError(
                f"{self.key}: {value!r} is not an allowed value "
                f"(allowed: {[f'{v:g}' for v in self.allowed]})"
            )
        if self.integer:
            if num != int(num):
                raise PrefsValueError(
                    f"{self.key}: {value!r} must be a whole number "
                    f">= {self.floor:g}"
                )
            return int(num)
        return num

    def format(self, value: float | int) -> str:
        return f"{value:g}{self.unit}"


MOTION = EnumPref(
    key="motion", default="reduced", allowed=("reduced",), floor="reduced",
    css_var="--pw-motion", data_attr="data-pw-motion",
)
CONTRAST = EnumPref(
    key="contrast", default="comfortable",
    allowed=("comfortable", "high"), floor="comfortable",
    css_var="--pw-contrast", data_attr="data-pw-contrast",
)
TEXT_SCALE = NumberPref(
    key="text_scale", default=1.0, floor=1.0,
    allowed=(1.0, 1.25, 1.5),
    css_var="--pw-text-scale", data_attr="data-pw-text-scale",
)
DENSITY = EnumPref(
    key="density", default="comfortable",
    allowed=("comfortable", "compact"), floor="compact",
    css_var="--pw-density", data_attr="data-pw-density",
)
TARGET_SIZE = NumberPref(
    key="target_size", default=44, floor=44, integer=True, unit="px",
    allowed=(44, 56),
    css_var="--pw-target-size", data_attr="data-pw-target-size",
)
COMPANION = EnumPref(
    key="companion", default="personal-world",
    allowed=(
        "personal-world", "mermaid", "robot",
        "world-tree-squirrel", "taco-news-truck",
    ),
    floor="personal-world",
    css_var="--pw-companion", data_attr="data-pw-companion",
)
ACCENT = EnumPref(
    key="accent", default="world-keeper",
    allowed=("world-keeper", "rylee"),
    floor="world-keeper",
    css_var="--pw-accent", data_attr="data-pw-accent",
)
PREFS: dict[str, EnumPref | NumberPref] = {
    p.key: p
    for p in (MOTION, CONTRAST, TEXT_SCALE, DENSITY, TARGET_SIZE,
              COMPANION, ACCENT)
}


def coerce_value(key: str, raw: Any) -> Any:
    """Coerce a raw input (CLI string or JSON value) toward its type.
    Numbers arrive as strings from the CLI; anything unparseable stays
    a string and is rejected by the spec validator."""
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def normalize_prefs(prefs: dict[str, Any] | None = None) -> dict[str, Any]:
    """Effective preferences: absent or invalid stored values fall back
    to the accessible defaults, never to below-floor values."""
    out: dict[str, Any] = {}
    for key, spec in PREFS.items():
        raw = (prefs or {}).get(key)
        if raw is None:
            out[key] = spec.default
            continue
        try:
            out[key] = spec.validate(coerce_value(key, raw))
        except PrefsValueError:
            out[key] = spec.default
    return out


def get_prefs(world: Any) -> dict[str, Any]:
    """Effective presentation preferences for a World (settings absent
    -> defaults). Reads the world's accessibility settings; anything
    outside the contract falls back to the floor-satisfying default."""
    stored = getattr(world, "accessibility", None)
    return normalize_prefs(stored if isinstance(stored, dict) else None)


def set_prefs(world: Any, updates: dict[str, Any]) -> dict[str, Any]:
    """Validate and apply preference updates. Raises PrefsValueError on
    any unknown key, below-floor value, or out-of-vocabulary value;
    nothing is applied unless every key validates."""
    if not isinstance(updates, dict):
        raise PrefsValueError("prefs must be an object of key -> value")
    effective = get_prefs(world)
    errors: list[str] = []
    for key, value in updates.items():
        spec = PREFS.get(key)
        if spec is None:
            errors.append(f"unknown preference {key!r}")
            continue
        try:
            effective[key] = spec.validate(coerce_value(key, value))
        except PrefsValueError as e:
            errors.append(str(e))
    if errors:
        raise PrefsValueError("; ".join(errors))
    store = getattr(world, "accessibility", None)
    if not isinstance(store, dict):
        store = {}
    store.update(effective)
    world.accessibility = store
    return dict(effective)


def prefs_to_css_variables(prefs: dict[str, Any] | None = None) -> dict[str, str]:
    """CSS custom properties (--pw-*). The target-size variable is
    clamped to the 44px floor regardless of density, so compact can
    never shrink hit targets."""
    p = normalize_prefs(prefs)
    out: dict[str, str] = {}
    for key, spec in PREFS.items():
        if isinstance(spec, NumberPref):
            value = p[key]
            if key == "target_size":
                value = max(int(value), TARGET_SIZE_FLOOR)
            out[spec.css_var] = spec.format(value)
        else:
            out[spec.css_var] = str(p[key])
    return out


def prefs_to_data_attributes(prefs: dict[str, Any] | None = None) -> dict[str, str]:
    """data-* attributes for the document root element."""
    p = normalize_prefs(prefs)
    out: dict[str, str] = {}
    for key, spec in PREFS.items():
        value = p[key]
        out[spec.data_attr] = (
            f"{value:g}" if isinstance(value, (int, float)) else str(value)
        )
    return out


def prefs_style_block(prefs: dict[str, Any] | None = None) -> str:
    """Server-rendered <style id="pw-prefs"> block: CSS custom
    properties, the OS-level prefers-reduced-motion fallback, and the
    one consumption rule the prefs own. No JavaScript anywhere."""
    p = normalize_prefs(prefs)
    variables = prefs_to_css_variables(p)
    lines = "\n".join(f"  {k}: {v};" for k, v in variables.items())
    motion = p["motion"]
    return (
        '<style id="pw-prefs">\n'
        ":root {\n"
        f"{lines}\n"
        "}\n"
        "@media (prefers-reduced-motion: reduce) {\n"
        "  :root { --pw-motion: reduced; }\n"
        "}\n"
        f'[data-pw-motion="{motion}"] * '
        "{ animation: none !important; transition: none !important; }\n"
        "</style>"
    )
