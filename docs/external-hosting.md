# External Hosting Notes

Recommended public exposure:

- `studio.example.com` -> Docker web endpoint
- `api.example.com` -> Docker API endpoint
- `nexus.example.com` -> Docker Nexus endpoint, only when access control is ready
- Do not expose the database directly to the public internet

Reverse proxy guidance:

- Route `/` to the React web service.
- Route `/api` to the Spring Boot API service.
- Route `/docs` to the API static docs path when docs are needed.
- Preserve `Host` and `X-Forwarded-Proto` headers.
- Keep timeouts generous enough for long-running terminal or file operations.

TLS placement:

- Terminate TLS at the edge proxy.
- Forward plain HTTP to the Docker service network.

DNS model:

- One public hostname for the web gateway is enough for normal use.
- Extra service hostnames should stay internal unless they have authentication and rate limits.

Operational caveat:

- Keep Docker endpoint ports and reverse proxy targets documented in `docs/service-access.md`.
