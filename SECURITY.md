# Security

Please use GitHub’s private vulnerability reporting feature when it is enabled on the public repository. Until a private channel is configured, do not post exploit details, private information, or credentials in a public issue. Ask the maintainer for a private contact without disclosing the sensitive details.

The living edition is a static site. Contributions contain only bounded JSON data, and no user-provided HTML or JavaScript is executed. Pull request automation has read-only repository permissions and does not receive deployment secrets. Publishing runs separately on trusted main-branch code and only after the owner enables it.

Maintainers should keep dependencies current, review workflow changes carefully, review creator credit and content, and require current validation checks before merging.

## Exterior signs

`sign.html` is an authoring format, not a browser document. parse5 parses it without executing it. An allowlist converts supported elements, text, and inline styles into plain drawing instructions, then the application paints those onto a Canvas texture. No `innerHTML`, iframe, contributed JavaScript, external font, URL, or image loading is used. Text-only React details and directory entries remain separate from the artwork.

The compiler caps source length (2,000 characters), visited nodes (60), nesting (8 levels), text runs (3), and characters per run (24). Only fixed font sizes and six-digit hex colors are accepted. Validation runs in the editor, local save endpoint, command-line checks, and production build. Tests cover script, event, link, image, iframe, SVG, external CSS, oversized markup, and unsupported property rejection. Review text content and creator identity as well as validation results.
