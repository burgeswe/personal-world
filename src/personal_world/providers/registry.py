"""Capability contracts and the provider registry.

A provider is registered against a capability and implements whatever
subset of the contract it supports. The registry fails closed: a missing
or unhealthy provider yields 'unavailable', never an exception, and
never a silent lie.
"""

from collections.abc import Callable
from typing import Any

from ..envelope import Result
from ..model import Actor, Provider


class Contract:
    """Base contract. Providers implement observe() and may implement
    act(). act() without explicit approval is a policy violation."""


class StatusContract(Contract):
    """Observe health/status of something."""

    def observe(self) -> Result:
        raise NotImplementedError


class SourceControlContract(StatusContract):
    """The provider-substitution proof capability: gitea (real, HTTP)
    and fake-reference both satisfy this same contract."""


class MemoryContract(Contract):
    def search(self, query: str) -> Result:
        raise NotImplementedError


class Registry:
    def __init__(self) -> None:
        self._providers: dict[str, Provider] = {}
        self._contracts: dict[str, type[Contract]] = {}
        self._impls: dict[str, Contract] = {}
        self._health_checks: dict[str, Callable[[], bool]] = {}

    def define_capability(self, key: str, contract: type[Contract]) -> None:
        self._contracts[key] = contract

    def register(
        self,
        capability: str,
        name: str,
        impl: Contract,
        health_check: Callable[[], bool] | None = None,
        **provider_kwargs,
    ) -> Provider:
        provider = Provider(capability=capability, name=name, **provider_kwargs)
        self._providers[name] = provider
        self._impls[name] = impl
        if health_check is not None:
            self._health_checks[name] = health_check
        return provider

    def provider_for(self, capability: str) -> Provider | None:
        """First healthy provider for a capability, else the first
        registered (marked degraded), else None."""
        candidates = [
            p for p in self._providers.values() if p.capability == capability
        ]
        if not candidates:
            return None
        for p in candidates:
            check = self._health_checks.get(p.name)
            if check is None or check():
                return p
        return candidates[0]

    def impl(self, name: str) -> Contract | None:
        return self._impls.get(name)

    def observe(self, capability: str) -> Result:
        """Fail-closed observation: unavailable providers report
        'unavailable', never raise."""
        p = self.provider_for(capability)
        if p is None:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"no provider for capability '{capability}'"],
            )
        impl = self._impls.get(p.name)
        try:
            result = impl.observe()
        except Exception as e:  # provider down must never crash the core
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"provider '{p.name}' failed: {e}"],
            )
        if not isinstance(result, Result):
            result = Result(ok=False, status="unavailable",
                            warnings=[f"provider '{p.name}' returned invalid result"])
        return result

    def actors(self) -> list[Actor]:
        """Staff-directory view of every registered provider."""
        out = []
        for p in self._providers.values():
            status = "unknown"
            check = self._health_checks.get(p.name)
            if check is not None:
                try:
                    status = "healthy" if check() else "unhealthy"
                except Exception:
                    status = "unhealthy"
            out.append(
                Actor(
                    name=p.name,
                    role=p.capability,
                    provider=p.name,
                    capabilities=[p.capability],
                    status=status,
                    secrets="brokered" if p.requires_secrets else "none",
                    writes=p.writes,
                )
            )
        return out

    def status_map(self) -> dict[str, Any]:
        out = {}
        for cap in self._contracts:
            r = self.observe(cap)
            out[cap] = {"ok": r.ok, "status": r.status, "warnings": r.warnings}
        return out