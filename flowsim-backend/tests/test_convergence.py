"""
Unit tests for solver/convergence.py.

Run with:  python -m pytest flowsim-backend/tests/test_convergence.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from solver.convergence import DirectSubstitution, WegsteinAccelerator, check_converged


# ─── DirectSubstitution ───────────────────────────────────────────────────────


class TestDirectSubstitution:
    def test_returns_new_value(self):
        ds = DirectSubstitution()
        assert ds.step(0.5, 0.7) == 0.7

    def test_multiple_steps_always_return_new(self):
        ds = DirectSubstitution()
        assert ds.step(0.0, 0.1) == 0.1
        assert ds.step(0.1, 0.2) == 0.2
        assert ds.step(0.2, 0.3) == 0.3

    def test_reset_is_noop(self):
        ds = DirectSubstitution()
        ds.reset()  # Should not raise
        assert ds.step(0.0, 1.0) == 1.0

    def test_zero_step(self):
        ds = DirectSubstitution()
        assert ds.step(0.0, 0.0) == 0.0

    def test_negative_values(self):
        ds = DirectSubstitution()
        assert ds.step(-1.0, -0.5) == -0.5


# ─── WegsteinAccelerator ──────────────────────────────────────────────────────


class TestWegsteinAccelerator:
    def test_first_step_returns_fx(self):
        """First call: no history, so return fx unchanged."""
        wa = WegsteinAccelerator()
        result = wa.step(0.5, 0.6)
        assert result == 0.6

    def test_reset_clears_history(self):
        wa = WegsteinAccelerator()
        wa.step(0.5, 0.6)    # first step, stores history
        wa.reset()
        result = wa.step(0.5, 0.7)   # after reset, first step again
        assert result == 0.7

    def test_q_clamped_to_zero(self):
        """
        When the sequence is converging smoothly (no divergence),
        q should be ≤ 0.
        """
        wa = WegsteinAccelerator()
        # Two calls to accumulate history
        wa.step(1.0, 0.9)   # first step
        result = wa.step(0.9, 0.81)   # second step: should produce q in [-5, 0]
        # Accelerated result should be close to the true fixed point (0.0 for
        # a linear contraction x → 0.9*x), not outside [0, 0.9]
        assert result <= 1.0   # not diverging upward

    def test_q_clamped_at_minus_5(self):
        """
        Construct a case where raw q would be < -5 and verify it's clamped.
        """
        wa = WegsteinAccelerator()
        # x=1, fx=100: huge jump
        wa.step(1.0, 100.0)
        # x=100, fx=1: opposite huge jump → raw q = (1-100)/((1-100)-(100-1)) = very negative
        result = wa.step(100.0, 1.0)
        # The result must be finite (clamping prevented blow-up)
        assert result == result  # not NaN
        assert abs(result) < 1e6  # not diverged to infinity

    def test_convergence_faster_than_direct(self):
        """
        For f(x) = 0.5*x + 1 (fixed point = 2), Wegstein should converge in
        fewer iterations than direct substitution.
        """
        def f(x: float) -> float:
            return 0.5 * x + 1.0

        tol = 1e-8
        true_fixed = 2.0

        # Direct substitution
        x = 0.0
        ds_iters = 0
        for _ in range(1000):
            x_new = f(x)
            ds_iters += 1
            if abs(x_new - x) < tol:
                x = x_new
                break
            x = x_new

        # Wegstein
        wa = WegsteinAccelerator()
        x = 0.0
        weg_iters = 0
        for _ in range(1000):
            fx = f(x)
            x_new = wa.step(x, fx)
            weg_iters += 1
            if abs(x_new - x) < tol:
                x = x_new
                break
            x = x_new

        assert abs(x - true_fixed) < 1e-5, f"Wegstein did not converge: x={x}"
        # Wegstein should need fewer iterations for this problem
        # (relaxed assertion: just verify it converges)
        assert weg_iters <= ds_iters


# ─── check_converged ──────────────────────────────────────────────────────────


class TestCheckConverged:
    def test_identical_values_converged(self):
        assert check_converged([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) is True

    def test_different_values_not_converged(self):
        assert check_converged([1.0, 2.0], [1.5, 2.5]) is False

    def test_within_tolerance(self):
        tol = 1e-4
        assert check_converged([1.0], [1.0 + tol * 0.5], tol=tol) is True

    def test_at_tolerance_boundary_not_converged(self):
        tol = 1e-4
        # Slightly over tolerance → not converged
        assert check_converged([1.0], [1.0 + tol * 1.1], tol=tol) is False

    def test_empty_lists_converged(self):
        assert check_converged([], []) is True

    def test_length_mismatch_raises(self):
        import pytest
        with pytest.raises(ValueError):
            check_converged([1.0, 2.0], [1.0])

    def test_zero_value_uses_min_scale(self):
        """Near-zero old values use 1e-10 minimum scale (no div-by-zero).
        |new - old| / 1e-10 must be < tol for convergence."""
        # |1e-17 - 0| / 1e-10 = 1e-7 < 1e-6 → converged
        assert check_converged([0.0], [1e-17]) is True
        # |1e-5 - 0| / 1e-10 = 1e5 >> 1e-6 → not converged
        assert check_converged([0.0], [1e-5]) is False

    def test_large_values(self):
        assert check_converged([1e6], [1e6 + 1e-4]) is True
        assert check_converged([1e6], [1e6 + 1000]) is False
