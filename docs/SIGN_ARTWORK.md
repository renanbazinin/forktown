# A little sign outside your home

The builder's **Outdoor sign** tab previews your artwork as you type. A simple text sign is enough to start. Choose **HTML artwork** for styled lettering: a shop name, welcome, or small poster.

This is a limited artwork language, not a full HTML page. Forktown converts it into a flat canvas picture on your building. It cannot be clicked, navigate, run scripts, or request outside content. Making arbitrary HTML unclickable would not provide that boundary; the application never runs it as HTML in the first place.

```html
<div style="background-color: #35554A; color: #FFF4D4; text-align: center">
  <strong style="font-size: 24px">MOONBEAM</strong>
  <p style="font-size: 12px">Coffee &amp; company</p>
</div>
```

Supported elements are `div`, `p`, `span`, `strong`, `b`, and `br`. Only the `style` attribute is accepted. Each nonempty text run becomes a separate centered line by default; nested spans do not share a line. Whitespace is collapsed and character entities such as `&amp;` are decoded. `br` may separate text runs but does not add a blank line.

| CSS property       | Accepted values                                           |
| ------------------ | --------------------------------------------------------- |
| `color`            | Six-digit hex, such as `#FFF4D4`                          |
| `background-color` | Six-digit hex on the outer element; fills the entire sign |
| `font-size`        | `12px`, `16px`, `20px`, `24px`, `28px`                    |
| `font-weight`      | `normal`, `bold`, `400`, `700`                            |
| `text-align`       | `left`, `center`, `right`                                 |

The sign is 240 × 100 pixels before being scaled onto the house. It holds up to three text runs of 24 characters each. Text may be compressed horizontally to fit. Keep the source under 2,000 characters with at most 60 nodes and 8 nested levels.

The JSON `sign` object has `mode`, `text`, `color`, `background`, and `html` fields. In `text` mode the text/colors are used; in `html` mode the markup controls the artwork; in `none` mode nothing is drawn. Keep all five fields in the object. The builder supplies them and handles JSON escaping for you.

Scripts, links, images, SVG, forms, event attributes, classes, external styles, and other CSS properties are rejected with a field error. An unfinished draft shows a placeholder until its artwork is valid. Invalid artwork cannot be saved or included in a production build.
