---
name: h5publish
description: Publish any local HTML file to a public temporary H5 link through the h5publish Cloudflare Worker. Use when the user asks to host, publish, preview publicly, share, generate a public link, or use h5publish for an HTML/H5 artifact.
---

# H5 Publish

## When To Use

Use this skill when the user has a local HTML file or HTML content and wants a public shareable link.

Common user requests:

- `把 /path/to/page.html 托管成一个链接`
- `帮我发布这个 HTML`
- `这个 H5 调用 skill 托管试试`
- `给这个网页生成一个可以分享的公网链接`
- `用 h5publish skill 发布 /path/to/page.html`

Default public base URL:

```text
https://h5.h5hub.xyz
```

Successful page URLs look like:

```text
https://h5.h5hub.xyz/p/xxxxxx
```

## Required User Notice

Before publishing, briefly tell the user these constraints. Do not ask for confirmation unless the content appears risky or the user has not provided a concrete file.

- Do not publish illegal, infringing, phishing, gambling, pornographic, scam, malware, credential-collection, impersonation, or misleading pages.
- Do not publish company secrets, personal privacy data, customer data, access tokens, internal links, or pages that depend on sensitive cookies.
- Links are temporary. Default page TTL is 7 days.
- Single HTML file limit is 5 MB.
- Anonymous publishing is rate-limited by source IP: 3 publishes/hour and 10 publishes/day.
- Access limits can expire a page: more than 30 unique visitors/day, more than 100 page views/day, or more than 200 total page views.
- Availability depends on DNS and network access to the custom domain. Mainland China access may still vary by network.

## Standard Workflow

1. Verify the HTML file exists.
2. Publish with the bundled script. The script automatically reads saved login config from `~/.h5publish/config.json`.
3. Return only the successful public URL plus any relevant caveat.
4. If publish fails with `Unauthorized` or `401`, ask the user for the invite code and run the login command below.
5. If publish fails for other reasons, diagnose using the failure handling section below.

## Invite Code Login

If the Worker requires a publish token, the user should only need to enter the invite code once inside the current Agent conversation. Store it locally with:

```bash
node "$SKILL_DIR/scripts/publish-html.mjs" login INVITE_CODE
```

If `SKILL_DIR` is not set:

```bash
node scripts/publish-html.mjs login INVITE_CODE
```

This writes:

```text
~/.h5publish/config.json
```

Future publishes automatically use that saved invite code. The precedence order is:

```text
--token / --url > H5PUBLISH_TOKEN / H5PUBLISH_WORKER_URL > ~/.h5publish/config.json > https://h5.h5hub.xyz
```

For a small trusted group, one shared invite code is acceptable. For wider public use, prefer per-user or per-team tokens so abuse can be traced and revoked without rotating everyone.

Preferred command:

```bash
node "$SKILL_DIR/scripts/publish-html.mjs" /absolute/path/to/page.html "Page title"
```

If `SKILL_DIR` is not set by the runtime, resolve it to this skill folder and run:

```bash
node scripts/publish-html.mjs /absolute/path/to/page.html "Page title"
```

For stdin:

```bash
cat ./page.html | node "$SKILL_DIR/scripts/publish-html.mjs" - "Page title"
```

Machine-readable output:

```bash
node "$SKILL_DIR/scripts/publish-html.mjs" --json /absolute/path/to/page.html "Page title"
```

## Runtime Options

- `--url WORKER_URL`: Override the Worker URL for one publish.
- `--token TOKEN`: Send a bearer token if the Worker requires `PUBLISH_TOKEN`.
- `--json`: Print JSON.
- `login INVITE_CODE`: Save the invite code locally for future publishes.
- `H5PUBLISH_WORKER_URL`: Default Worker URL override.
- `H5PUBLISH_TOKEN`: Bearer token environment override.

Example override:

```bash
H5PUBLISH_WORKER_URL="https://h5.h5hub.xyz" node "$SKILL_DIR/scripts/publish-html.mjs" ./dist/index.html "Campaign H5"
```

## Success Criteria

A successful publish prints:

```text
Publish succeeded
URL: https://h5.h5hub.xyz/p/xxxxxx
Code: xxxxxx
```

Return the `URL:` line to the user.

If verifying with curl, use `GET`, not `HEAD`. The Worker only handles `GET` for pages and `/api/health`; `curl -I` sends `HEAD` and may return `404`.

Correct verification:

```bash
curl -sS https://h5.h5hub.xyz/api/health
curl -sS https://h5.h5hub.xyz/p/xxxxxx | head -c 160
```

Expected health response:

```json
{"ok":true}
```

## Failure Handling

### File Problems

If the file does not exist, ask the user for the correct path.

If the file is larger than 5 MB, do not publish. Ask the user whether to compress, split, or use another hosting method.

### Network Or DNS Problems

If publishing fails with connection, TLS, DNS, or timeout errors, check:

```bash
curl -sS --connect-timeout 10 --max-time 15 https://h5.h5hub.xyz/api/health
dig +short NS h5hub.xyz
dig +short @8.8.8.8 NS h5hub.xyz
dig +short @1.1.1.1 NS h5hub.xyz
dig +short h5.h5hub.xyz
```

Expected NS records:

```text
konnor.ns.cloudflare.com.
melany.ns.cloudflare.com.
```

Expected `h5.h5hub.xyz` resolution is Cloudflare edge IPs.

If DNS is not active, tell the user that domain propagation is still pending and retry later.

### Cloudflare Worker Custom Domain State

The current production setup uses:

```text
zone: h5hub.xyz
custom domain: h5.h5hub.xyz
worker service: h5publish
```

If Cloudflare dashboard/API is available, verify:

- Zone status is `active`.
- Worker custom domain `h5.h5hub.xyz` is enabled.
- Worker service is `h5publish`.
- Health endpoint returns `{"ok":true}`.

### Workers.dev Fallback

Historical workers.dev domains may exist, but do not use them as the default because they were unreliable from the local network:

```text
https://h5publish.kefreeshare.workers.dev
https://h5publish.ccxinxiaoxin.workers.dev
```

Use `https://h5.h5hub.xyz` unless the user explicitly requests otherwise.

## Packaging Notes

When packaging this skill for another Agent, include:

```text
SKILL.md
scripts/publish-html.mjs
```

The script is self-contained Node.js and uses built-in `fetch`, so it expects Node.js 18+.

For invited users, the receiving Agent can run `node scripts/publish-html.mjs login INVITE_CODE` once. After that, the script reads `~/.h5publish/config.json` automatically.

If you host this skill on GitHub for others to install, publish only the skill folder or package contents:

```text
skills/h5publish/SKILL.md
skills/h5publish/scripts/publish-html.mjs
```

Do not include `.DS_Store`, local config, Cloudflare tokens, admin tokens, or historical handoff files.

## Operational Notes

- Default page TTL: 7 days.
- Default Worker URL: `https://h5.h5hub.xyz`.
- Public pages are served from `/p/{code}`.
- Publish API endpoint: `POST /api/publish`.
- Health endpoint: `GET /api/health`.
- Admin APIs may require `ADMIN_TOKEN`; do not expose tokens to the user.
