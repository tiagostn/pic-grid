# pic-grid

PWA instalável no Windows para montar folhas A4 com fotos em grade e exportar PDF ou imagem. Toda imagem fica no navegador: não há upload nem servidor de fotos.

Documento para revisão. A implementação fica para outra sessão.

## Tecnologia

**Vite + React + TypeScript**, empacotado como PWA com `vite-plugin-pwa`.

| Peça | Escolha | Por quê |
| --- | --- | --- |
| App | Vite, React, TypeScript | Um só bundle estático. Estado da folha (grade, ordem, legendas, cortes) fica simples de manter. |
| Estilo | Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/dropzone`) | Controles prontos para este uso: número, interruptor, seletor retrato/paisagem, modal do corte, soltar arquivos. Tema claro, botões com texto visível. |
| Instalação | `vite-plugin-pwa` (manifest + service worker) | Edge e Chrome no Windows instalam como aplicativo. Depois da primeira abertura, o app abre offline. |
| PDF | `pdf-lib` | Posiciona foto e legenda em milímetros na página A4, sem HTML-to-PDF. |
| Imagem | Canvas `toBlob` | A mesma folha, rasterizada em PNG ou JPEG. Várias páginas num `.zip` (`jszip`). |
| Pixels da foto | Canvas / `createImageBitmap` | Recorte, zoom e redimensionamento antes de entrar no PDF ou na imagem da folha. |
| Corte na tela | `react-easy-crop` | Pan, zoom e retângulo de corte, com proporção livre ou fixa. |
| Rascunho | IndexedDB (`idb`) | Guarda o projeto (fotos + layout) se a janela fechar. |
| HEIC | `heic2any`, só quando o arquivo for HEIC/HEIF | Foto de iPhone. Chrome não decodifica HEIC sozinho. |

Não usar Next.js, Electron nem Tauri. Next sobra servidor que este produto não tem. Electron/Tauri instalam nativo, mas a pedido é PWA.

Mantine só nos controles. A folha A4, a grade e o canvas de exportação ficam em CSS próprio, para a medida em milímetros não depender do tema. Pacotes Mantine que não entram: dates, charts, notifications, tiptap, form. Um `NumberInput` e um `SegmentedControl` bastam no lugar de um form library.

**Onde publicar o app (não as fotos).** Um host estático (GitHub Pages, Cloudflare Pages ou pasta servida em localhost) entrega só o HTML/JS. As fotos não saem do computador. Sem esse host, o Windows não instala PWA a partir de `file://`.

**Navegador alvo:** Edge ou Chrome no Windows. São os que instalam PWA e abrem o diálogo nativo para salvar PDF, imagem ou zip (`showSaveFilePicker`). Firefox fica como download comum do arquivo.

## Objetivo de uso

Uma pessoa escolhe fotos do disco, ajusta o enquadramento, distribui numa grade de N colunas por M linhas, em retrato ou paisagem, opcionalmente com uma legenda curta sob cada foto, e gera um PDF A4 ou uma imagem da mesma folha para imprimir em casa.

## Fora de escopo

- Conta, login, nuvem, sincronização, compartilhamento.
- Servidor que receba imagem.
- Edição avançada: filtros, camadas, retoque, texto sobre a foto, desenho livre.
- Tamanho de papel diferente de A4 (carta, A3, foto 10×15).
- Imposição tipográfica, sangria de gráfica, marcas de registro de impressão profissional.
- Reconhecimento de rosto, álbum automático, legenda por IA.

## Folha A4

Medidas fixas:

- Retrato: 210 × 297 mm
- Paisagem: 297 × 210 mm

Cada célula da grade reserva, de cima para baixo:

1. Área da foto
2. Faixa da legenda, se a legenda estiver ligada

Cálculo da célula (mm):

```text
larguraInterna = 210 ou 297 − margemEsquerda − margemDireita
alturaInterna  = 297 ou 210 − margemSuperior − margemInferior

larguraCelula = (larguraInterna − espaçamentoX × (colunas − 1)) / colunas
alturaCelula  = (alturaInterna  − espaçamentoY × (linhas − 1)) / linhas

alturaLegenda = legendasLigadas ? alturaFaixaLegenda : 0
alturaFoto    = alturaCelula − alturaLegenda
```

A foto exportada preenche a área da foto no modo **cover** (corta o que passar da célula, usando o enquadramento escolhido no editor). Modo **contain** (foto inteira, com faixa branca) fica como opção acessória.

DPI padrão de saída: **200**. Suficiente para jato de tinta doméstico e PDF leve. Opção de 300 na exportação.

Pixels embutidos por foto ≈ `(lado em mm / 25.4) × DPI`. Exemplo: célula de 90 mm a 200 DPI ≈ 709 px no lado maior. O original grande é reduzido a esse tamanho antes de entrar na exportação.

A imagem da folha inteira usa o mesmo DPI. A4 retrato a 200 DPI ≈ 1654 × 2339 px. Paisagem ≈ 2339 × 1654 px.

## Funcionalidades essenciais

### App instalável e privado

- Manifest PWA: nome `pic-grid`, ícone, `display: standalone`, orientação livre.
- Service worker faz precache do app. Sem rede, o app abre; fotos já salvas no rascunho continuam disponíveis.
- Nenhuma requisição envia bytes de imagem. Processamento só em memória, Canvas e IndexedDB.
- Tela inicial explica em uma frase: as fotos não saem deste computador.

### Entrada de fotos

- Selecionar um ou vários arquivos (`image/jpeg`, `image/png`, `image/webp`).
- Arrastar arquivos do Explorer para a página.
- Corrigir orientação EXIF ao decodificar, para foto de celular não entrar de lado.
- Recusar ou avisar formato não suportado, sem quebrar a folha já montada.
- Várias fotos de uma vez entram na ordem do nome do arquivo. Dá para reordenar depois.

### Folha e grade

- Uma folha ativa, com orientação retrato ou paisagem.
- Colunas e linhas editáveis (inteiros ≥ 1). Limite prático sugerido: 10 × 10, para a célula não virar selo ilegível.
- Presets: 1×1, 2×2, 2×3, 3×3, 3×4, 4×5. Preset só preenche N e M; o usuário pode ajustar em seguida.
- Trocar orientação ou N×M recalcula a pré-visualização. Fotos e legendas permanecem; o que não couber vai para a página seguinte.
- Célula vazia é válida.
- Margens da página em mm (padrão 10) e espaçamento entre células em mm (padrão 3).
- Ordem de preenchimento: esquerda → direita, cima → baixo.
- Mais fotos do que células geram páginas A4 extras na mesma exportação.
- Reordenar fotos na lista (arrastar). Remover uma foto tira só ela da grade.
- Duplicar uma foto para outra célula.

### Legenda

- Interruptor global: mostrar ou ocultar a faixa de legenda.
- Texto por foto, curto, editável. Vazio = só a foto, e a faixa some naquela célula (a foto pode usar a altura da faixa) **ou** a faixa fica em branco para alinhar a grade. Padrão recomendado: faixa reservada em todas as células quando o interruptor global está ligado, para a grade não ficar torta.
- No máximo 2 linhas; o que passar é cortado com reticências.
- Tamanho da fonte único na folha, em pt (padrão 9).
- Alinhamento: esquerda ou centro (padrão centro).
- Fonte com acentos do português. No PDF, WinAnsi cobre ç, ã, é. Na imagem, a mesma família (arquivo de fonte empacotado no app, desenhado com `fillText`) para a legenda não mudar de tamanho entre os dois formatos. Sem emoji na legenda; se aparecer, substituir ou avisar.
- Atalho acessório: preencher a legenda com o nome do arquivo, sem extensão.

### Editor de uma foto

Aberto a partir da célula ou da lista. Trabalha numa foto por vez.

- Pan (arrastar a imagem dentro do quadro).
- Zoom (roda do mouse, pinça, controle deslizante).
- Recorte retangular. O quadro do corte segue a proporção da área da foto na célula, para o que se vê no editor ser o que sai na folha.
- Proporção livre como alternativa, quando a pessoa quiser cortar sem amarrar à célula.
- Girar 90° horário e anti-horário.
- Espelhar horizontal.
- Grade de terços por cima do corte, só visual.
- Aplicar grava o recorte na foto da folha. Cancelar descarta.
- Restaurar original (desfaz corte, giro e espelho).

“Corte” e “recorte” aqui são o mesmo gesto: escolher o retângulo que entra na célula. Não há ferramenta de laço, polígono nem borracha.

### Pré-visualização

- Página A4 desenhada na proporção real, com margem, fotos, legendas e páginas extras.
- Clique na foto abre o editor.
- Aviso discreto se a foto, depois do corte, ficar abaixo do DPI alvo (vai pixelizar na impressão).

### Exportar

Dois formatos, a partir do mesmo layout em milímetros. O PDF mantém texto e fotos separados. A imagem é a folha inteira rasterizada.

**PDF**

- Um arquivo, uma página A4 por folha, na orientação escolhida.
- Cada foto entra como JPEG na resolução do DPI escolhido (padrão qualidade ~0,85).
- Fundo branco.
- Nome sugerido: `pic-grid-AAAA-MM-DD-HHmm.pdf`.

**Imagem**

- PNG (padrão) ou JPEG da página inteira, no mesmo DPI e na mesma orientação.
- PNG preserva a legenda nítida. JPEG da folha usa a mesma qualidade do JPEG das fotos (padrão ~0,85).
- Fundo branco, margens e legendas inclusas. O que se vê na pré-visualização é o que sai no arquivo.
- Uma página: um arquivo `pic-grid-AAAA-MM-DD-HHmm.png` (ou `.jpg`).
- Várias páginas: um `.zip` com `pagina-01.png`, `pagina-02.png`, e assim por diante. Não juntar páginas numa tira vertical.

Comum aos dois:

- No Edge/Chrome: diálogo do Windows para escolher pasta e nome. Nos outros: download.
- Enquanto gera, botão desabilitado e progresso (página atual / total). Erro de memória ou de foto inválida aparece em texto, sem arquivo pela metade.

## Funcionalidades acessórias

Úteis no uso real, sem mudar o produto. Implementar depois do fluxo essencial, nesta ordem.

1. **Rascunho local.** Autosave no IndexedDB: layout, legendas, recortes e blobs. Reabrir o app restaura o último projeto. Botão para apagar o rascunho.
2. **HEIC/HEIF.** Converter no cliente para JPEG antes do mesmo fluxo. Avisar que a conversão demora e usa memória.
3. **Contain além de cover.** Foto inteira visível na célula, com barra branca se a proporção não bater.
4. **Guias de corte.** Linha fina (ex.: 0,2 pt, cinza) na borda de cada célula, para tesoura. Não entram na área da foto.
5. **Borda branca interna** em mm, entre a foto e a borda da célula (“moldura”).
6. **Cabeçalho da folha** opcional: uma linha (título ou data), acima da grade, descontada da altura interna.
7. **DPI e qualidade JPEG** na exportação: 150 / 200 / 300 e qualidade 0,7–0,95. Vale para o PDF e para a imagem JPEG. Mostrar estimativa grosseira do tamanho.
8. **Legenda = nome do arquivo** para todas, de uma vez.
9. **Aviso de resolução** por célula, com o DPI efetivo.
10. **Desfazer/refazer** limitado ao editor de corte (não precisa cobrir a folha inteira na primeira versão).
11. **Atalhos:** Delete remove a foto selecionada; setas movem a seleção na grade; Ctrl+Enter exporta no último formato escolhido (padrão PDF).
12. **Zoom da pré-visualização** (ajustar à janela / 100%).
13. **Imprimir direto** (`window.print`) da pré-visualização, com `@page { size: A4 }`. O PDF continua sendo o resultado principal; impressão direta é atalho e depende do navegador respeitar A4.
14. **Vários projetos nomeados** no IndexedDB (além do autosave único), com data. Evita perder uma folha ao começar outra.
15. **Arrastar foto entre células** na própria pré-visualização, não só na lista.

Não entram nesta leva, a menos que a revisão peça: filtros, texto desenhado na imagem, outros papéis, colaboração, histórico infinito de undo da folha.

## Fluxo principal

1. Abrir o app instalado (ou o site, na primeira vez, e instalar pelo Edge).
2. Soltar as fotos.
3. Escolher retrato ou paisagem e a grade (preset ou N×M).
4. Ligar legenda se quiser e preencher os textos.
5. Abrir cada foto que precise de enquadramento, ajustar zoom e corte, aplicar.
6. Olhar a pré-visualização, inclusive páginas extras.
7. Exportar PDF ou imagem e imprimir.

## Telas

- **Folha.** Pré-visualização A4, controles de orientação, N, M, margens, espaçamento, legendas, exportar (PDF, PNG ou JPEG), lista de fotos.
- **Editor.** Overlay ou painel com a foto, zoom, corte, girar, aplicar, cancelar.
- **Projetos** (acessório). Lista de rascunhos locais; pode esperar a segunda leva e, na primeira, só restaurar o último automaticamente.

Uma coluna de controles e a folha ao lado cabem num notebook. Abaixo de ~900 px de largura, os controles passam para cima da folha. Não é alvo de celular; o uso é o PC Windows.

## Dados locais

Não há API. Um projeto:

```text
Project
  id, nome, atualizadoEm
  orientacao: "retrato" | "paisagem"
  colunas, linhas
  margemMm, espacoMm
  legendasLigadas, fonteLegendaPt, alinhamentoLegenda
  dpi, qualidadeJpeg
  fotos: Foto[]          # ordem = ordem de preenchimento das células

Foto
  id
  nomeArquivo
  blobOriginal           # IndexedDB
  legenda
  transformacao:
    crop { x, y, largura, altura }   # normalizado 0–1 sobre o bitmap já orientado
    rotacao90: 0 | 1 | 2 | 3
    espelhoHorizontal: boolean
```

PDF e imagem não ficam no projeto. Geram de novo a partir desses dados. O último formato de exportação (pdf, png ou jpeg) pode ser lembrado no projeto.

Cota sugerida de rascunho: avisar acima de ~200 MB no IndexedDB e oferecer apagar originais já exportados. Não bloquear a exportação por causa disso.

## Qualidade e limites

- Respeitar EXIF antes de qualquer corte.
- Não recomprimir em cadeia: o JPEG de cada foto nasce do bitmap recortado, uma vez só. A imagem da folha é outro arquivo, pintado a partir desse bitmap.
- Foto que falhar na decodificação sai da seleção com mensagem e o resto segue.
- Geração em sequência (uma página por vez), não todas em paralelo, para não estourar memória com originais de 4000 px ou mais.
- Legenda não desenha por cima da foto; fica na faixa abaixo.
- Contraste da UI suficiente para ler controles e legendas. Botões com nome visível, não só ícone.
- Sem conta de usuário: limpar dados do site no Edge apaga os rascunhos. A cópia que importa é o PDF ou a imagem salva em disco.

## Critério de pronto da primeira versão

- Instala no Edge do Windows e reabre offline.
- Monta grade N×M, retrato e paisagem, com margens.
- Recorta com zoom e pan, alinhado à célula.
- Legenda opcional sob a foto, com acento.
- PDF A4 com uma ou mais páginas, fotos só no cliente.
- Imagem PNG da mesma folha (um arquivo, ou zip se houver mais de uma página).
- EXIF de orientação corrigido.
- Rascunho do último projeto restaurado ao abrir.

O resto da lista acessória pode ficar para o passo seguinte da implementação.
