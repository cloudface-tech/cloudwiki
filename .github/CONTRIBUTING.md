# Contributing to CloudWiki

Thank you for considering contributing to CloudWiki! Every contribution helps make this project better for everyone.

## Ways to contribute

- **Code** -- Fix bugs, add features, improve performance
- **Documentation** -- Improve guides, add examples, fix typos
- **Translations** -- Help translate the interface into your language
- **Bug reports** -- File detailed reports with steps to reproduce
- **Ideas** -- Suggest features in [Discussions](https://github.com/gmowses/cloudwiki/discussions)
- **Testing** -- Try new releases and report issues

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/cloudwiki.git`
3. Create a branch from `vega`: `git checkout -b feat/my-feature vega`
4. Set up the dev environment (see [README](../README.md#development))
5. Make your changes
6. Verify the build: `cd ux && pnpm build`
7. Push and open a Pull Request against the `vega` branch

## Pull request guidelines

- **One PR per feature or fix** -- Keep changes focused
- **Describe what and why** -- Not just what you changed, but why it matters
- **Use conventional commits** -- `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Test your changes** -- At minimum, verify `pnpm build` passes
- **Keep it small** -- Smaller PRs are easier to review and merge faster

## Code style

- Follow existing patterns in the codebase
- Vue components use Pug templates and SCSS
- Server code uses ES Modules (.mjs)
- Use meaningful variable and function names

## Reporting bugs

Open a [GitHub Issue](https://github.com/gmowses/cloudwiki/issues/new?template=bug_report.yml) with:

- Steps to reproduce
- Expected vs actual behavior
- Browser, OS, and CloudWiki version
- Screenshots or logs if applicable

## Requesting features

Start a [Discussion](https://github.com/gmowses/cloudwiki/discussions/categories/ideas) describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

## Questions?

Open a [Discussion](https://github.com/gmowses/cloudwiki/discussions) or check existing ones first.

---

Thank you for helping make CloudWiki better.
