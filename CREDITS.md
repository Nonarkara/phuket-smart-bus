# Credits

## Hero drawing

`assets/hero.svg` is an original drawing made for this repository.

The mood — a dry brush, paper grain, and a large empty field — is inspired by the ink landscapes in Takehiko Inoue’s manga *Vagabond*. No panel, figure, face, lettering, seal script, or composition from that work is reproduced. Those rights stay with the artist and the publisher. The bus is a few rectangles and circles. There is no rider.

## Palette tokens

The colours are production tokens from [Dr Non’s Palette](https://dao.nonarkara.org/PALETTE-DESIGN.md), chapter 3, source plate 69, the pairing that document calls civic restraint.

| Role | Value | Where it comes from |
|---|---|---|
| Source pair | Warm Gray `#a1a39a`, Black `#111314` | Plate 69 |
| Day reading ground | `#d5d6d2` | Lighter source mixed 55% toward white |
| Day reading ink | `#050606` | Darker source mixed 68% toward black |
| Night reading ground | `#64655f` | Lighter source shaded 35% toward black, then 5% steps until relative luminance is at most 0.14 |
| Night reading ink | `#ffffff` | Night reading rule |
| Study marks | Blue `#006eb8`, Lilac `#b984af` | Chapter 3 study plate |
| Seal | Burnt Sienna `#ae5224` | Chapter 3 artifact plate |

The mix is the `daoPaletteRoles` function published in [`chapter_palettes.js`](https://dao.nonarkara.org/chapter_palettes.js) on that site. The 76/24 split (paper, then a black band) is that system’s chapter-identity proportion. Screen values are approximations of printed colour, as that project states.

The historical combinations are Sanzo Wada’s, via the dataset in [`mattdesl/dictionary-of-colour-combinations`](https://github.com/mattdesl/dictionary-of-colour-combinations) (MIT, copyright © 2020 Matt DesLauriers), which corrected data first compiled by Dain M. Blodorn Kim for `dblodorn/sanzo-wada`. This drawing is not affiliated with Seigensha, the Wada estate, or those data authors, and it does not reproduce scans or cover art.

The dataset’s MIT notice:

> Copyright (c) 2020 Matt DesLauriers
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Everything else

Map tiles, tracker feeds, timetables, flight fixtures, and photographs elsewhere in the tree have their own owners. See the data-sources table in [README.md](README.md). Do not read this file as a licence for those materials.
