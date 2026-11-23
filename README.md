# receipts site

Served by GitHub Pages from this branch.

- `index.html`: the landing page. It reuses `demo/style.css`. `demo-light.png` and `demo-dark.png` are screenshots of the demo.
- `demo/`: the share pages from [receipts](https://github.com/trivedi-vatsal/receipts) (`share/` on `main`), with made-up data for a fictional engineer. `data.json` is the source. `data.js` was built from it and six weekly notes by `scripts/build-share.py`. Each demo page also has an added top bar that links back to the landing page.

To refresh the demo after the pages change on `main`, copy `share/app.js` and `share/style.css` into `demo/`. If you copy the `.html` files too, add the top bar again.
