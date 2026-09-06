# PixelPromptStudio source provenance

The files in this directory were copied or adapted from the prompt-generator portion of
`kleiveist/PixelForgeStudio`.

- Primary source revision: `a4784cbb3b991c37cb5e87855f2025c0565cc4ff`
  (`🚀 release: ship PixelForge Studio 4.0`, 5 September 2026).
- Prompt-only compatibility baseline: `d253e7a948dc80ce766fe5e7ca76440f1f418c85`
  (`🚀 release: complete PixelForge Prompt Studio v2 migration`, 3 September 2026).
- The compatibility baseline was used for the prompt-only settings/schema boundary and the
  initial prompt test corpus. Tests whose runtime contracts changed after that revision were
  rebased on the primary source revision.
- Phase P23 isolates the Prompt module, removes imports of the PixelForge application shell and
  Animation Studio, creates prompt-only barrels, and preserves the stable V2 data contracts.
- Host navigation, scoped root styles, native persistence, the shared header, and the Cutout
  handoff are intentionally assigned to the subsequent integration phases.

No PixelForgeStudio start page, overall header/footer, `StudioSwitcher`, animation project
provider, animation workspace/editor, worker, or `main.tsx` is included.

## Upstream license notice

MIT License

Copyright (c) 2026 Pixelart Prompt Studio contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
