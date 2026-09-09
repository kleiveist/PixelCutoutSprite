<!-- PYGINDEX:NAVIGATION START -->
[Parent overview](../index.md)
<!-- PYGINDEX:NAVIGATION END -->

# Portable tooling documentation

<!-- PYGINDEX:INDEX START -->
## Contents

### Pages
- [Portable tooling documentation](README.md)

### Sections
- [Acceptance](acceptance/index.md)
- [Architecture](architecture/index.md)
- [Case-study working area](case-study/README.md)
- [Development](development/index.md)
- [Guides](guides/index.md)
- [Integration](integration/index.md)
- [Reference](reference/index.md)
<!-- PYGINDEX:INDEX END -->

This documentation travels with the `tools/` directory. It explains the observed
implementation of Template Tooling: project-local context resolution, profile-selected
adapters, bounded structured changes, transactional integration, explicit live actions,
versioned folder replacement, verification, and acceptance evidence.

Start with [Check](integration/check.md) before applying any integration. Use the
[installation guide](guides/install.md) only when you intentionally want a live dependency
action, and read [security boundaries](development/security-boundaries.md) before changing
ownership or process policies.

The tooling is deliberately not an application scaffold. Missing product paths remain
informational, foreign product content stays project-owned, and copied payload metadata proves
self-consistency rather than publisher authenticity.

## Documentation map

For a compact operational route, continue with the [guides overview](guides/guides.md).
