<div align="center">

<img src="resources/icon.png" alt="Printify" width="96" />

# Printify

**Print e gravação de tela para Windows, em um atalho.**
Selecione uma área, anote e salve. Ou grave em MP4 ou GIF, sem diálogos no caminho.

[![Última versão](https://img.shields.io/github/v/release/tonissx/printify?label=vers%C3%A3o&color=2ea043)](https://github.com/tonissx/printify/releases/latest)
[![Licença MIT](https://img.shields.io/github/license/tonissx/printify?color=blue)](LICENSE)
![Plataforma](https://img.shields.io/badge/Windows%2010%2F11-x64-0078d4)

[Baixar](#instalação) · [Como usar](#como-usar) · [Compilar](#compilar-a-partir-do-código)

</div>

---

## Como usar

O Printify fica na bandeja do sistema e espera por dois atalhos.

| Atalho | O que faz |
| --- | --- |
| **Ctrl + Print Screen** | Abre a seleção de área para um **print**, com as ferramentas de anotação |
| **Ctrl + G** | Abre a seleção de área para uma **gravação**. Com a gravação em andamento, para e salva |

A interface existe para sumir: atalho, seleção, pronto. Nenhum diálogo de nome ou pasta entre você e o resultado.

### Print

1. **Ctrl + Print Screen**. A tela congela e escurece.
2. Arraste para selecionar a área. Dá para mover e redimensionar pelas alças. **F** seleciona a tela inteira.
3. Anote, se quiser, e aperte **Enter** (salva e copia) ou **Ctrl + C** (só copia).

O PNG vai para `Imagens\Printify\` e também para a área de transferência.

| Ferramenta | Atalho | Observação |
| --- | --- | --- |
| Selecionar e mover | **V** | Clique num desenho para selecioná-lo e arraste. **Delete** apaga |
| Caneta | **P** | Traço livre |
| Marca-texto | **H** | Faixa translúcida reta |
| Linha | **L** | |
| Retângulo | **R** | Só contorno |
| Seta | **A** | |
| Texto | **T** | **Enter** ou um clique fora salva o texto |

Depois de soltar um desenho, a ferramenta volta sozinha para **Selecionar e mover**. **Esc** desativa a ferramenta
atual; um segundo **Esc** fecha o print. **Ctrl + Z** desfaz o último desenho. O botão direito também volta para o cursor.

### Gravação

1. **Ctrl + G** e selecione a área.
2. Escolha microfone, contagem de 3 s (desligada por padrão) e o formato: **MP4** ou **GIF**.
3. **Enter** ou **R** começa a gravar. O indicador de gravação (cronômetro, pausar, parar) aparece no canto superior
   direito e **fica fora do vídeo**.
4. **Ctrl + G** de novo, ou o botão de parar, salva na hora. A conversão para MP4/GIF termina em segundo plano.

O vídeo vai para `Vídeos\Printify\`. O GIF é limitado aos primeiros 30 segundos e a 720 px de largura.

### Menu da bandeja

Clique com o botão direito no ícone do Printify: capturar, gravar, abrir a pasta de capturas e
**Bordas arredondadas nos prints** (desligado por padrão; quando ligado, o PNG sai com cantos de 12 px transparentes).

---

## Instalação

[**⬇ Baixar a versão mais recente**](https://github.com/tonissx/printify/releases/latest). Não precisa de Node,
ffmpeg ou nada além do instalador (`Printify Setup x.y.z.exe`). O ffmpeg já vem dentro do app.

**Requisito:** Windows 10 ou 11, 64 bits.

### Assinatura digital

**O instalador ainda não é assinado digitalmente.** Na primeira execução, o Windows SmartScreen pode mostrar
"O Windows protegeu o computador": clique em **Mais informações → Executar assim mesmo**.

Para conferir a procedência:

1. **Baixe só da página oficial de releases**: `github.com/tonissx/printify/releases`.
2. **Confira o hash SHA-256** com o `SHA256SUMS.txt` da mesma release:

   ```powershell
   Get-FileHash .\Printify.Setup.x.y.z.exe -Algorithm SHA256
   ```

3. **Confira o atestado de procedência** (prova de que o arquivo saiu do workflow de release deste repositório).
   Precisa do [GitHub CLI](https://cli.github.com/):

   ```bash
   gh attestation verify "Printify.Setup.x.y.z.exe" -R tonissx/printify
   ```

### Atalho já em uso?

`Ctrl + Print Screen` é o atalho padrão de outros programas de captura, como o **Lightshot**. Dois programas não
podem registrar a mesma combinação: se o Printify não abrir com o atalho, feche o outro programa. O Windows também pode
abrir a Ferramenta de Recorte com a tecla Print Screen; desative em **Configurações → Acessibilidade → Teclado →
Usar o botão Print Screen para abrir captura de tela**.

---

## Limitações

- **Só Windows.** macOS e Linux não são alvo.
- A captura abre **no monitor onde está o cursor**.
- **Não há modo "Janela"** nem câmera na gravação: a captura é por área ou tela inteira.
- Os atalhos ainda não são configuráveis.
- Nem todo aplicativo respeita PNG com transparência na área de transferência: com as bordas arredondadas ligadas, os
  cantos podem aparecer pretos ou brancos ao colar. O arquivo salvo tem a transparência correta.

---

## Compilar a partir do código

Node 24+:

```bash
git clone https://github.com/tonissx/printify.git
cd printify
npm install
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Abre o app em modo de desenvolvimento, com recarga |
| `npm run typecheck` | Checagem de tipos (TypeScript) |
| `npm test` | Testes (Vitest) |
| `npm run build` | Compila para `out/` |
| `npm run dist` | Instalador Windows (NSIS) em `dist/`, sem publicar |
| `npm run tokens` | Regenera `tokens.css` a partir de `tokens.json` |

Para abrir direto na captura, sem depender do atalho: `PRINTIFY_OPEN=shot` ou `PRINTIFY_OPEN=record` antes de
`npm run dev` (no PowerShell: `$env:PRINTIFY_OPEN="shot"`).

### Estrutura

```
src/main/       processo principal: atalhos, janelas, bandeja, arquivos, ffmpeg
src/preload/    ponte IPC tipada entre o principal e a interface
src/renderer/   interface (React): seleção, anotações, indicador de gravação, aviso
  ds/           componentes do design system Printify (Button, IconButton, Kbd, Segmented, RecordPill, Toast, Icon)
  lib/          recorte com cantos arredondados e anotações
  styles/       tokens.json do design system, tokens.css gerado e bundle.css
src/shared/     tipos compartilhados
scripts/        gerador de tokens, ícone e cálculo de versão do release
tests/          Vitest
```

### Design system

Cores, tipografia, espaçamento e componentes seguem o design system **Printify** (tokens claro/escuro, fonte Geist,
uma única cor de marca para "isto captura"). Os tokens ficam em `src/renderer/styles/tokens.json`; rode
`npm run tokens` depois de alterá-los.

---

## Releases

Todo PR mergeado na `main` publica uma nova versão automaticamente
([`.github/workflows/release.yml`](.github/workflows/release.yml)):

1. **Versão**: `major.minor` vem do `package.json` e o patch é o número da execução do workflow. Ela nunca regride em
   relação à última tag publicada (`scripts/compute-version.mjs`). Para uma versão nova (`0.2.0`, `1.0.0`), altere o
   `version` do `package.json` no PR.
2. **Release**: cria a tag `vX.Y.Z` e a página da release, com as notas geradas dos PRs.
3. **Build**: no Windows, roda `typecheck` e testes; só se passarem compila o instalador e o anexa à release.
4. **Verificação**: gera o `SHA256SUMS.txt` e o atestado de procedência dos instaladores.

---

## Licença

O código do Printify é [MIT](LICENSE).

O instalador inclui um binário do [ffmpeg](https://ffmpeg.org/) (pacote `ffmpeg-static`) para converter as gravações.
Esse binário é compilado com `--enable-gpl` e libx264, e por isso é distribuído sob a **GPL-3.0**; o texto da licença
vai junto, em `LICENSE.ffmpeg.txt`, na pasta de instalação. O código-fonte do ffmpeg está em
[ffmpeg.org](https://ffmpeg.org/download.html#get-sources).
