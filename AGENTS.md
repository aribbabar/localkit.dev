# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code. Route entry points live in `src/pages/`, shared layouts in `src/layouts/`, reusable UI in `src/components/`, and browser-side processing helpers in `src/lib/`. Documentation content is stored in `src/content/docs/`, global styles in `src/styles/`, and static public assets in `public/`. Tests and binary fixtures live in `tests/`. Treat `dist/` and `.astro/` as generated output; edit source files instead.

## Build, Test, and Development Commands
Run `npm install` once to install dependencies. Use `npm run dev` to start the Astro dev server locally, `npm run build` to create a production build in `dist/`, and `npm run preview` to serve the built site for a final check. Run `npx vitest` for the full test suite or target a file with `npx vitest tests/image-conversion.test.ts`.

## Coding Style & Naming Conventions
Use TypeScript ESM with 2-space indentation and double quotes, matching the existing source. Keep Astro pages and route files in kebab-case, for example `src/pages/tools/image-converter.astro`. Use PascalCase for React and Astro component filenames such as `ImageConverterTool.tsx` and `Navbar.astro`. Put tool-specific helpers beside the tool when tightly scoped, and shared browser logic in `src/lib/`. Format changes with Prettier before submitting, for example `npx prettier --write src/components/image-converter/ImageConverterTool.tsx`.

## Testing Guidelines
Vitest is the test runner. Add or update `*.test.ts` files under `tests/` and keep fixture assets in the matching subfolder, such as `tests/pdf/` or `tests/videos/`. Prefer focused tests around browser-safe utility logic in `src/lib/` and tool behavior that can run without a full browser session. Run the affected test file locally before opening a PR.

## Commit & Pull Request Guidelines
Recent commits use short, sentence-style summaries like `implemented the search functionality` and `added support for pdf to word`. Keep commit messages brief, lowercase, and focused on one change. PRs should include a clear description, note any user-visible behavior changes, link related issues when applicable, and attach screenshots or short recordings for UI updates.

## Contributor Notes
This project is privacy-first and browser-only by design. Avoid introducing server-side processing for tool features unless the change is explicitly intended to alter that architecture.
