# Unir PDFs

Aplicação web estática para unir múltiplos arquivos PDF diretamente no navegador.

## Privacidade

Os documentos não são enviados para nenhum servidor pela aplicação. Todo o processamento ocorre localmente no navegador do usuário por meio da biblioteca `pdf-lib`.

> Observação: a aplicação carrega a biblioteca `pdf-lib` a partir de um CDN público. Os PDFs selecionados continuam sendo processados localmente e não são enviados ao CDN.

## Funcionalidades

- Seleção de múltiplos PDFs
- Arrastar e soltar arquivos
- Reorganização da ordem
- Remoção individual de arquivos
- Contagem de páginas
- Limite de segurança de 30 arquivos
- Limite total de 500 MB
- União local no navegador
- Download do PDF final
- Sem backend
- Sem banco de dados
- Sem login

## Estrutura

```text
pdf-merge/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Testar localmente

Por ser uma aplicação estática, você pode abrir `index.html` diretamente no navegador.

Para evitar diferenças de comportamento entre navegadores, também pode usar um servidor local simples:

```bash
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

## Publicar no GitHub Pages

1. Crie um novo repositório no GitHub.
2. Envie `index.html`, `style.css`, `app.js` e `README.md`.
3. Entre em **Settings > Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/root`.
6. Salve.
7. O GitHub disponibilizará a URL pública da ferramenta.

## Limitações desta versão

PDFs protegidos por senha podem não ser processados.

Arquivos extremamente grandes podem consumir muita memória porque o processamento é feito integralmente no dispositivo do usuário.

A ferramenta une os PDFs sem comprimir ou converter o conteúdo original.
