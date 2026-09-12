"""Core world model: stable truth.

Facts, Intent, Policy, Lore, Capabilities, Providers, Journal events.
All records carry provenance; classification metadata marks data classes.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from .classification import Classification, meta


def now() -> datetime:
    return datetime.now(UTC)


class Provenance(BaseModel):
    source: str
    observed_at: datetime = Field(default_factory=now)
    provider: str | None = None
    authority: str = "observed"


class Authority(str, Enum):
    OBSERVED = "observed"
    REPORTED = "reported"
    INFERRED = "inferred"


class Fact(BaseModel):
    key: str
    value: Any
    provenance: Provenance
    classification: Classification = Classification.WORLD


class Intent(BaseModel):
    key: str
    value: Any
    provenance: Provenance
    classification: Classification = Classification.WORLD
    """What the user wants to be true. Explicit, inspectable, never inferred."""


class Mutability(str, Enum):
    NORMAL = "normal"
    CEMENTED = "cemented"


class Override(str, Enum):
    NONE = "none"
    EXPLICIT_USER_REQUEST_ONLY = "explicit_user_request_only"


class PolicyEffect(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


class Policy(BaseModel):
    """Hard rule. Preference is Intent; Policy is what may never happen.

    ``mutability: cemented`` forbids modification by AI inference,
    automation, provider output, imports, discovery, and derived lore.
    Only an explicit user action may change it (see world.py mutate gate).
    """

    key: str
    effect: PolicyEffect
    override: Override = Override.NONE
    mutability: Mutability = Mutability.NORMAL
    provenance: Provenance
    classification: Classification = Classification.WORLD


class LoreState(str, Enum):
    CONFIRMED = "confirmed"
    DERIVED = "derived"
    SUGGESTED = "suggested"
    EPHEMERAL = "ephemeral"


PROMOTION_PATH: dict[LoreState, set[LoreState]] = {
    LoreState.EPHEMERAL: {LoreState.SUGGESTED, LoreState.CONFIRMED},
    LoreState.SUGGESTED: {LoreState.CONFIRMED},
    LoreState.DERIVED: {LoreState.CONFIRMED},
    LoreState.CONFIRMED: set(),
}


class Lore(BaseModel):
    key: str
    value: Any
    state: LoreState
    provenance: Provenance
    classification: Classification = Classification.PRIVATE
    derivation: str | None = None


class Capability(BaseModel):
    """What the world can observe or do, independent of provider."""

    key: str
    description: str | None = None
    native_baseline: bool = False
    """True when the core itself gives the capability useful local
    meaning with zero providers connected (framework Rule 2)."""


class ProviderMode(str, Enum):
    """How a provider relates to its capability (framework Rule 3).

    native       -- core-owned baseline implementation; ships with the
                    OSS product and works standalone.
    enrichment   -- optional third-party richness; absence degrades
                    fidelity, never validity (default).
    replacement  -- swaps the native baseline for another system; still
                    substitutable like any other provider.
    """

    NATIVE = "native"
    ENRICHMENT = "enrichment"
    REPLACEMENT = "replacement"


class Provider(BaseModel):
    """Mapping of a capability to a concrete system. Never hardcoded.

    Optional is the default; ``required: true`` is an explicit, rare,
    justified exception (framework Rule: providers cannot quietly
    become required).
    """

    capability: str
    name: str
    mode: ProviderMode = ProviderMode.ENRICHMENT
    required: bool = False
    required_reason: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    status: str = "unknown"
    requires_secrets: list[str] = Field(default_factory=list)
    writes: str = "none"
    classification: Classification = Classification.WORLD


class Actor(BaseModel):
    """Structured staff-directory entry for a connected component."""

    name: str
    role: str
    provider: str | None = None
    capabilities: list[str] = Field(default_factory=list)
    status: str = "unknown"
    secrets: str = "none"
    writes: str = "none"


class JournalKind(str, Enum):
    OBSERVATION = "observation"
    HEALTH = "health"
    DRIFT = "drift"
    RECOMMENDATION = "recommendation"
    APPROVAL = "approval"
    RECONCILIATION = "reconciliation"
    PROVIDER_ACTION = "provider_action"
    FAILURE = "failure"
    PACK_CHANGE = "pack_change"
    SETTINGS_CHANGE = "settings_change"
    SECURITY = "security"
    DISCOVERY = "discovery"


class JournalEvent(BaseModel):
    ts: datetime = Field(default_factory=now)
    kind: JournalKind
    summary: str
    provenance: Provenance
    classification: Classification = Classification.PRIVATE
    # ── Supersede support (journal correction workflow, 2026-09-12).
    # Additive and optional so every pre-existing row validates
    # unchanged. `ts` (UTC, unique per append in practice) is the
    # natural entry key used for chain links. The journal is
    # append-only: the ORIGINAL row is never rewritten — currency is
    # derived by readers from supersedes links on the newer entries.
    # Set on the NEW (current) entry naming what it replaces:
    supersedes: datetime | None = None
    # Short human reason for the correction, when one was supplied.
    # Kept on the new entry so history answers "why" where the
    # correction is read.
    supersede_reason: str | None = None


class Pack(BaseModel):
    """Recipe: structure, never a person's data."""

    key: str
    version: str = "1"
    capabilities: list[str] = Field(default_factory=list)
    schedule: dict[str, Any] = Field(default_factory=dict)
    policies: dict[str, Any] = Field(default_factory=dict)
    presentation: dict[str, Any] = Field(default_factory=dict)
    compatibility: dict[str, Any] = Field(default_factory=dict)


class Accessibility(BaseModel):
    motion: str = "reduced"
    contrast: str = "normal"
    text_scale: float = 1.0
    density: str = "normal"
    targets: str = "normal"


SCHEMA_VERSION = "1"
"""World persistence schema version. `personal-world init` stamps it;
loaders treat a mismatch as an explicit migration need, never a silent
reinterpretation."""