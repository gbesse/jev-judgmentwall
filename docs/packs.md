# Pack format

This document describes the auditable JSON contract consumed by Judgment Wall.

Every pack has an `id`, a `title`, and a non-empty `criteria` array. Each criterion has a unique `id`, visible `label`, one Jev `type`, exact `instructions`, the type-appropriate `criteria`, and an optional display `group`. The UI exposes those exact fields; it never substitutes generated prose.
