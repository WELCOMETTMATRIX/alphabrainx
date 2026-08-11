# Security Policy

Alpha Brain uses public market APIs plus its existing server-side AI integration. Please report suspected vulnerabilities privately instead of opening public exploit issues.

## Secret Handling

- `FINNHUB_API_KEY` must remain a server-side environment variable.
- Do not commit `.env.local`, `.dev.vars`, logs, build output, or downloaded credentials.
- Avoid logging API keys, prompts containing secrets, user credentials, seed phrases, or wallet private keys.

## Reporting

Open a private security advisory or contact the project maintainer with:

- Affected route or file.
- Steps to reproduce.
- Impact and suggested mitigation.
