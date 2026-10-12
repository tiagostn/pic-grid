# pic-grid

Folhas A4 com fotos em grade, no navegador. As fotos não saem do computador.

Site: https://tiagostn.github.io/pic-grid/

## Publicar de novo

Cada push na branch `main` gera o site e publica no GitHub Pages. Não é preciso subir a pasta `dist`.

```bash
git add -A
git commit -m "mensagem"
git push
```

O endereço continua https://tiagostn.github.io/pic-grid/. A atualização leva cerca de um minuto. O andamento fica em Actions, no fluxo **Publicar no GitHub Pages**.

Para publicar sem um commit novo: no GitHub, abra **Actions**, escolha **Publicar no GitHub Pages** e clique em **Run workflow**.

Se o repositório mudar de nome, troque `BASE` em `vite.config.ts`. O caminho do site é `/nome-do-repositorio/`.

## Uso local

```bash
npm install
npm run dev
```

Abre em http://localhost:5173/pic-grid/

```bash
npm test
npm run build
npm run preview
```
