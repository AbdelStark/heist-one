# Security policy

## Supported version

Security fixes currently target the latest release on `main` (`0.1.x`).

## Report a vulnerability

Please do not open a public issue for a vulnerability or include credentials,
private traces, or account data in a report. Use GitHub's private
**Report a vulnerability** flow on the repository Security tab:

<https://github.com/AbdelStark/heist-one/security/advisories/new>

Include the affected commit, impact, reproduction steps, and a minimal proof of
concept when possible. You should receive an acknowledgment within seven days.
There is no bug-bounty program.

## Credential exposure

If a TypeSafe key is exposed, revoke or rotate it in the provider console before
doing anything else. Removing a key from the latest commit is not sufficient if
it appeared in Git history, an issue, an artifact, a trace, or a recording.

HEIST//ONE reads live credentials only on the server. `.env` files and generated
traces are ignored by Git; the browser receives neither the key nor raw provider
credentials.
