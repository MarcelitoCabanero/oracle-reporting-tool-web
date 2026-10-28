# Local development

## Prerequisites
- Node.js 22 LTS or a currently supported LTS release
- npm 10+
- Git

## Setup
1. Copy `.env.example` to `.env` in the repository root and set local values. Never commit `.env`.
2. Install workspace dependencies from the repository root:

   ```bash
   npm install
   ```

3. Start both services:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.
5. API health endpoint: `http://localhost:3001/api/health`.

## Validation
Run from the repository root:

```bash
npm run typecheck
npm run build
```

The initial scaffold includes a health endpoint only. SQL Server connectivity, login, and report routes are intentionally not enabled yet.
