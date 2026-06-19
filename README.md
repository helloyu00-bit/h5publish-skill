# h5publish skill

Publish local HTML files to a temporary public H5 link.

## Codex install

```bash
mkdir -p ~/.codex/skills && git clone https://github.com/helloyu00-bit/h5publish-skill.git ~/.codex/skills/h5publish
```

## Invite code

Run once after install, or the first time publishing fails with `Unauthorized`:

```bash
node ~/.codex/skills/h5publish/scripts/publish-html.mjs login YOUR_INVITE_CODE
```

## Use

Ask Codex:

```text
帮我把 /path/to/page.html 托管一下
```

Manual command:

```bash
node ~/.codex/skills/h5publish/scripts/publish-html.mjs /path/to/page.html "Page title"
```

## Notes

- Do not publish private data, secrets, customer data, internal links, illegal content, phishing, scams, malware, credential collection, or misleading pages.
- Links are temporary and default to 7 days.
- Single HTML file limit is 5 MB.
- This is an invited internal trial service.
