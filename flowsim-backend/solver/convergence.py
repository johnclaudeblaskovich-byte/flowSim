"""
flowsim-backend/solver/convergence.py

Convergence acceleration algorithms for tear-stream iterations.

- DirectSubstitution: x_{n+1} = f(x_n)  (no acceleration)
- WegsteinAccelerator: uses the Wegstein q-factor to accelerate convergence
  of mildly non-linear recycle loops.
- check_converged: tests whether all values have converged to a tolerance.
"""

from __future__ import annotations

import math


# ─── Direct Substitution ──────────────────────────────────────────────────────


class DirectSubstitution:
    """No-op accelerator: simply returns the new value unchanged."""

    def step(self, x_current: float, x_new: float) -> float:  # noqa: ARG002
        """Return x_new unchanged (direct substitution)."""
        return x_new

    def reset(self) -> None:
        """No state to reset."""


# ─── Wegstein Accelerator ─────────────────────────────────────────────────────


class WegsteinAccelerator:
    """
    Wegstein's method for accelerating convergence of successive-substitution.

    The q-factor is computed as:
        q = Δf / (Δf - Δx)
    and clamped to the interval [-5, 0] to ensure stability.

    The accelerated estimate is:
        x_next = (1 - q) * f(x_n) + q * x_n
    """

    Q_MIN: float = -5.0
    Q_MAX: float = 0.0

    def __init__(self) -> None:
        self._prev_x: float | None = None
        self._prev_fx: float | None = None

    def step(self, x: float, fx: float) -> float:
        """
        Given the current iterate x and its image fx = f(x), return an
        accelerated estimate for the next iterate.

        On the first call, returns fx unchanged (no history yet).
        """
        if self._prev_x is None:
            # First call — no acceleration, just store history
            self._prev_x = x
            self._prev_fx = fx
            return fx

        delta_x = x - self._prev_x
        delta_fx = fx - self._prev_fx

        # Compute q, guard against division by near-zero
        denom = delta_fx - delta_x
        if abs(denom) < 1e-15:
            q = 0.0
        else:
            q = delta_fx / denom

        # Clamp q to [-5, 0]
        q = max(self.Q_MIN, min(self.Q_MAX, q))

        # Accelerated estimate
        x_next = (1.0 - q) * fx + q * x

        # Update history
        self._prev_x = x
        self._prev_fx = fx

        return x_next

    def reset(self) -> None:
        """Clear stored history (call between solve attempts)."""
        self._prev_x = None
        self._prev_fx = None


# ─── Convergence check ────────────────────────────────────────────────────────


def check_converged(
    old_values: list[float],
    new_values: list[float],
    tol: float = 1e-6,
) -> bool:
    """
    Return True if all corresponding values have converged to within ``tol``.

    Convergence criterion:
        |new_i - old_i| / max(|old_i|, 1e-10) < tol  for all i
    """
    if len(old_values) != len(new_values):
        raise ValueError(
            f"Length mismatch: old={len(old_values)}, new={len(new_values)}"
        )
    for old, new in zip(old_values, new_values):
        scale = max(abs(old), 1e-10)
        if abs(new - old) / scale >= tol:
            return False
    return True
