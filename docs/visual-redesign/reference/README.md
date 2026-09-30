# Reference renderer (offline)

This harness displays the **existing** UI with synthetic Hunt records, importing its current view/style modules rather than redrawing an approximation. It does not import `userscript/main.js`, observe WebSockets, open IndexedDB, send game actions or visit PokePixel.

Build from the repository root:

```powershell
node docs/visual-redesign/reference/build.mjs
```

Open `docs/visual-redesign/reference/index.html?mode=desktop&panel=415&view=current` in a browser. Valid values: `mode=desktop|mobile`, `panel=415|620` (Desktop) and `view=current|history|misc|hud`.

To generate visual baselines at **actual** emulated viewport sizes (including 320px/390px Mobile), run:

```powershell
node docs/visual-redesign/reference/capture.mjs
```

This starts one isolated local headless Edge process, renders the sixteen documented states (four views × two sizes × two modes), and writes PNG snapshots plus measured panel/navigation geometry to `reference/screenshots/`. It never opens a game URL. Supply `EDGE_PATH` if Edge is installed elsewhere.

The emitted `reference.bundle.js` is a generated local preview asset, not part of the production userscript and not intended for commits or releases. Browser-only differences (viewport, native controls, media queries, virtual keyboard) still require actual viewport inspection. The demo does not exercise leadership, WebSocket handling or persistent database behavior.
