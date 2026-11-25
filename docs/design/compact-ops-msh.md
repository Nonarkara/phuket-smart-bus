# Compact operations — MSH brief

- **Who:** a Phuket bus operator opening `/ops` on a phone or a small laptop.
- **One job:** see where buses are running and decide whether a modelled airport shortfall warrants investigation.
- **Column grid and attention order:** map first; map source and the dispatch estimate at its lower edge; the evidence chain, replay priorities and conditions below. The map owns the wide track at tablet width; the supporting rows need not stretch to fill it.
- **Constraints:** keep map layers, routes, ferry lines, moving buses, replay, fleet navigation and every evidence block. Keep the existing dark wall palette and type. Distinguish GPS, simulation and unknown rider counts; no new motion. Wrapped text must not disable controls.
- **Direction:** an annotated airport operations map, with a field note at its edge. Space above the map is for controls, not a second dashboard.

## Geometry to protect

At 390 × 844 and 1024 × 768, the map starts within the first 225 CSS pixels, spans the working width, and occupies at least 56% of the first screen in simulation. The map is immediately followed by its source/status and the decision; context must not precede it in DOM or visual order. At 390 × 844 the decision heading starts in the first screen. At enlarged text sizes the evidence can flow down; it must not overflow sideways or disappear. These are compact-briefing budgets, not a claim about the wide wall layout.

| Viewport | Previous map top / height | Revised map top / height | Revised decision heading |
| --- | ---: | ---: | ---: |
| 390 × 844 | 923 / 549 px | 222 / 506 px | 799 px |
| 1024 × 768 | 524 / 499 px | 146 / 461 px | 676 px |

The former layout fails both the map-top and visible-area budgets. The browser regression test also clicks Flights and toggles it back by keyboard; collision-free CSS on its own is not proof that a control is usable.

Independent review checked the navigation and seven layer controls down to 320px, a 130% type-scale stress case, and forced live mode with the tracker offline. The controls scroll within their own rails, the legend clears attribution, and an unavailable feed does not show observed zeroes. On the 1440px wall view the flight board still precedes the map; the map spans about 66% of the width but only 38% of the viewport area. That larger composition remains a separate change.
