# Security

Please report security problems privately through GitHub’s private vulnerability reporting: [report a vulnerability](https://github.com/renanbazinin/forktown/security/advisories/new). Only the maintainers can read your report, and we’ll reply there. Please don’t post exploit details, private information, or credentials in a public issue, pull request, or discussion.

The living edition is a static site. Contributions contain bounded JSON data, and no contributed sign HTML or JavaScript executes in the site. The PR build uses read-only repository permissions without deployment secrets. A separate trusted contribution policy reads PR data through the GitHub API and can write commit statuses; it never checks out or runs contributor code. Publishing runs separately on trusted main-branch code, and only in repositories where the owner has turned it on.

Maintainers should keep dependencies current, review workflow changes carefully, review creator credit and content, and require current validation checks before merging.

## Exterior signs

`sign.html` is an authoring format, not a browser document. parse5 parses it without executing it. An allowlist converts supported elements, text, and inline styles into plain drawing instructions, then the application paints those onto a Canvas texture. No `innerHTML`, iframe, contributed JavaScript, external font, URL, or image loading is used. Text-only React details and directory entries remain separate from the artwork.

The compiler caps source length (2,000 characters), visited nodes (60), nesting (8 levels), text runs (3), and characters per run (24). Only fixed font sizes and six-digit hex colors are accepted. Validation runs in the editor, local save endpoint, command-line checks, and production build. Tests cover script, event, link, image, iframe, SVG, external CSS, oversized markup, and unsupported property rejection. Review text content and creator identity as well as validation results.
