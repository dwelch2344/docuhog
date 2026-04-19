# Contributing to DocuHog

Thanks for your interest in improving DocuHog. This guide covers everything you need to get started.

## Prerequisites

- **Node.js 22+** -- DocuHog targets the latest LTS release
- **npm** -- comes with Node.js
- **Docker** (optional) -- for running the containerized setup or testing the Dockerfile
- **Git** -- for version control

## Development Setup

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR-USERNAME/docuhog.git
   cd docuhog
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   This runs the server with hot reload via `ts-node-dev`. The API and web UI will be available at [http://localhost:8025](http://localhost:8025).

4. **Verify everything works:**

   ```bash
   # In another terminal:
   curl http://localhost:8025/api/v1/health
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server (requires `npm run build` first) |
| `npm test` | Run the full test suite with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the codebase |
| `npm run lint:fix` | Lint and auto-fix issues |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Remove the `dist/` directory |

## Running Tests

Tests use [Jest](https://jestjs.io/) with [supertest](https://github.com/ladjs/supertest) for HTTP assertions:

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode during development
npm run test:watch
```

Please ensure all tests pass before submitting a pull request. New features and bug fixes should include tests.

## Code Style

DocuHog uses TypeScript in strict mode with ESLint and Prettier enforcing consistent style.

- **TypeScript** -- strict mode enabled (`"strict": true` in `tsconfig.json`)
- **ESLint** -- with `@typescript-eslint` rules
- **Prettier** -- for formatting

Before committing, run:

```bash
npm run lint
npm run format
```

### Guidelines

- Use explicit types rather than `any` wherever possible.
- Keep route handlers thin -- put business logic in `src/services/`.
- Follow the existing file organization (routes, services, types).
- Prefer `const` over `let`. Avoid `var`.
- Write descriptive error messages that help developers debug their integrations.

## Project Structure

```
src/
  index.ts           - App entry point
  config.ts          - Configuration from env vars
  server.ts          - Express app setup
  routes/            - API route handlers
    oauth.ts         - OAuth/token endpoints
    envelopes.ts     - Envelope CRUD + lifecycle
    templates.ts     - Template management
    recipients.ts    - Recipient views
    accounts.ts      - Account info endpoints
    ui.ts            - Web UI routes
  services/
    storage.ts       - Disk-based JSON storage
    smtp.ts          - SMTP email delivery
    envelope.ts      - Envelope business logic
  types/
    docusign.ts      - DocuSign API type definitions
  ui/                - Web UI static assets (HTML/CSS/JS)
```

## Pull Request Process

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits.

3. **Run the full check suite:**

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Push and open a pull request** against `main`.

5. **In your PR description**, include:
   - What the change does and why
   - How to test it
   - Any breaking changes or migration notes

### What makes a good PR

- **Small and focused** -- one logical change per PR
- **Tests included** -- for new features and bug fixes
- **Lint-clean** -- no new warnings
- **Descriptive commit messages** -- explain *why*, not just *what*

## Adding a New Mock Endpoint

If you are adding support for a new DocuSign API endpoint:

1. Add the route handler in the appropriate file under `src/routes/`.
2. Add any necessary types to `src/types/docusign.ts`.
3. If the endpoint involves storage, add logic to `src/services/storage.ts`.
4. Write tests covering the happy path and common error cases.
5. Update `docs/API.md` with the new endpoint, including example request/response JSON.
6. Update the API Compatibility table in `README.md`.

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/docusign/docuhog/issues/new) with:

- A clear title and description
- Steps to reproduce (for bugs)
- What you expected vs. what happened
- Your environment (Node version, OS, Docker version if applicable)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
