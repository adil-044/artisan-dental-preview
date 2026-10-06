# Artisan Dental — live demo

Waterdown dentist homepage demo for prospect review:

- Left-side AI booking popup (OpenRouter free models via local proxy)
- Lenis smooth scroll + GSAP pinned clinic tour (Uptisement pack motion)
- Interactive service cards (basic + major new-patient services)
- Real clinic gallery + LocalBusiness SEO schema
- Working appointment API (confirmation IDs on server)

## Run locally

```bash
cp .env.example .env   # add OPENROUTER_API_KEY
npm install
npm start
# optional public tunnel:
cloudflared tunnel --url http://127.0.0.1:$PORT
```

Never commit `.env`. API key stays on the server — not in browser JS.

## Vault

See `vaultsousxchef/200 - Insights/Artisan Dental Waterdown Demo Lock 2026-10-06.md`
