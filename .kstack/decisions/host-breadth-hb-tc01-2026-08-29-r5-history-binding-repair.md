# HB-TC01 round-5 repair 2 — historical registry and PRESERVE binding

Date: 2026-08-29  
Scope: the independent final-review round-5 history/PRESERVE finding only

## Historical verification

Historical verification accepts only the closed `HistoricalResolutionV1`
shape. The supplied source bundle, clause inventory, projection plan, render
bundle, and projection map must each declare the same trusted
`registrySetDigest`. Their internal digest edges must reproduce the same
one-way graph certified by the historical resolution. Resolver schema and
implementation identities must also agree between the historical resolution
and render bundle.

Recomputing an object's address is necessary but not sufficient: an object
from a different registry context is rejected even when the caller also
rewrites the historical digest field to match it.

## PRESERVE handoff

PRESERVE validates the closed historical-resolution shape and both render
inventories. It requires all of these exact bindings:

- candidate history digest = preservation-baseline history digest = address
  of the supplied historical resolution;
- candidate render digest = address of the supplied candidate render bundle;
- historical render digest = address of the supplied historical render
  bundle;
- candidate, baseline, installed manifest, historical resolution, and both
  render bundles share one registry;
- both render bundles share the candidate target and platform; and
- the candidate, historical, and installed member inventories remain byte
  identical under the existing path/length/content comparison.

A caller can no longer mint PRESERVE with an unused candidate-history claim or
transfer verified history across registries.
