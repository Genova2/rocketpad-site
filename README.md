# RocketPad — site institucional

Site estático (HTML + CSS + JS puro, sem build) servido por **Cloudflare Workers** via [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

## Estrutura

```
.
├── wrangler.jsonc        # configuração do Worker (serve ./public)
├── package.json
└── public/
    ├── index.html        # página única
    ├── 404.html
    ├── styles.css
    ├── script.js         # menu mobile, animações, formulário → mailto
    ├── _headers          # headers de segurança e cache
    ├── robots.txt, sitemap.xml, site.webmanifest
    ├── favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192/512.png
    └── assets/
        ├── rocket.webp           # emblema com fundo transparente
        ├── logo-rocketpad.png    # logo completo com fundo transparente
        └── og-image.jpg          # imagem de compartilhamento (1200×630)
```

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:8787
```

(Abrir `public/index.html` direto no navegador não carrega imagens e estilos, porque os caminhos começam com `/`. Use o `npm run dev`.)

## Publicar

```bash
npx wrangler login
npm run deploy
```

Para usar o domínio próprio, adicione uma *Custom Domain* ao Worker `rocketpad` no painel da Cloudflare (Workers & Pages → rocketpad → Settings → Domains & Routes).

## Personalizar

- **Domínio:** as URLs `https://rocketpad.com.br/` em `index.html` (canonical, Open Graph, JSON-LD), `robots.txt` e `sitemap.xml`.
- **E-mail de contato:** `contato@rocketpad.com.br` em `index.html` e na constante `CONTACT_EMAIL` de `script.js`.
- **Formulário:** por ser estático, o envio abre o app de e-mail do visitante com a mensagem pronta. Para receber direto, dá para trocar por um serviço de formulários ou por um handler no próprio Worker.
