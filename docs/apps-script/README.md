# Backend Apps Script - Painel Nobre Lar

Este projeto usa uma planilha do Google Sheets como banco de dados, através de
um Web App do Google Apps Script.

## 1. Preparar a planilha

Abra a planilha "PAINEL_GERENCIAL - NOBRE LAR" e confirme que a aba tem os
cabeçalhos exatamente assim na linha 1:

```
ID | NIVEL ENTREGA | LOJA | PEDIDO | VALOR DO PEDIDO | LOGISTICA | DATA |
ENTRADA | VENDEDOR | TRANFERENCIA | FATURAMENTO | DATA/HORA FATURAMENTO |
CIDADE | PENDENCIA | (vazio) | RESPONSAVEL | SAIDA | ENTREGUE DATA |
ENTREGUE HORA | ENTREGA
```

## 2. Criar o Web App

1. Na planilha, vá em **Extensões > Apps Script**.
2. Copie o conteúdo de [`Code.gs`](./Code.gs) para o editor.
3. Ajuste no topo do arquivo:
   - `SHEET_NAME` → nome exato da aba (ex.: `Vendas`).
   - `SHARED_SECRET` → uma senha qualquer (ex.: `nobrelar-2026-xyz`).
4. Salve (ícone de disquete).
5. Clique em **Implantar > Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL gerada (termina em `/exec`).

Sempre que alterar o `Code.gs`, use **Implantar > Gerenciar implantações > Editar
> Nova versão** para publicar a nova versão.

## 3. Configurar o app

Na raiz do projeto, crie/edite o arquivo `.env`:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
VITE_APPS_SCRIPT_SECRET=nobrelar-2026-xyz
```

Use o **mesmo valor** de `SHARED_SECRET` no `Code.gs` e em
`VITE_APPS_SCRIPT_SECRET`.

## 4. Como funciona

- **GET** na URL do Web App: retorna todos os pedidos da planilha em JSON.
- **POST** na URL do Web App:

  ```json
  {
    "secret": "nobrelar-2026-xyz",
    "action": "confirmar",
    "row": 42,
    "data": "31/01/26",
    "hora": "14:30"
  }
  ```

  Grava `data` na coluna **ENTREGUE DATA** e `hora` na coluna **ENTREGUE HORA**
  da linha `row`. Se `data` ou `hora` vierem vazios, o Apps Script usa o
  horário atual do servidor (fuso `America/Fortaleza`).
