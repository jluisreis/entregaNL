/**
 * Backend em Google Apps Script para o Painel de Entregas - Nobre Lar
 *
 * COMO USAR:
 * 1. Abra a planilha no Google Sheets.
 * 2. Menu Extensões > Apps Script.
 * 3. Cole este arquivo em `Código.gs` (substitua o conteúdo).
 * 4. Ajuste as constantes SHEET_NAME e SHARED_SECRET abaixo.
 * 5. Menu Implantar > Nova implantação > Tipo: App da Web.
 *    - Executar como: Eu (sua conta)
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL do App da Web (termina em /exec) e coloque no arquivo .env
 *    do projeto como VITE_APPS_SCRIPT_URL=...
 * 7. Coloque também VITE_APPS_SCRIPT_SECRET com o mesmo valor de SHARED_SECRET.
 *
 * A planilha deve ter os cabeçalhos na linha 1 exatamente como no CSV:
 * ID | NIVEL ENTREGA | LOJA | PEDIDO | VALOR DO PEDIDO | LOGISTICA | DATA |
 * ENTRADA | VENDEDOR | TRANFERENCIA | FATURAMENTO | DATA/HORA FATURAMENTO |
 * CIDADE | PENDENCIA | (vazio) | RESPONSAVEL | SAIDA | ENTREGUE DATA |
 * ENTREGUE HORA | ENTREGA | ...
 */

const SHEET_NAME = 'Vendas'; // ajuste para o nome da aba correta
const SHARED_SECRET = 'troque-este-segredo'; // igual ao VITE_APPS_SCRIPT_SECRET
const TIMEZONE = 'America/Fortaleza';

function _sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  return sh;
}

function _headers(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function _colIndex(headers, name) {
  const idx = headers.indexOf(name);
  if (idx === -1) throw new Error('Coluna não encontrada: ' + name);
  return idx + 1; // 1-based
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET: retorna todos os pedidos como JSON */
function doGet(e) {
  try {
    const sh = _sheet();
    const values = sh.getDataRange().getValues();
    const headers = values.shift().map(String);
    const rows = values
      .map((r, i) => {
        const obj = { _row: i + 2 };
        headers.forEach((h, j) => {
          let v = r[j];
          if (v instanceof Date) {
            v = Utilities.formatDate(v, TIMEZONE,
              h.indexOf('HORA') >= 0 ? 'HH:mm' : 'dd/MM/yy');
          }
          obj[h] = v;
        });
        return obj;
      })
      .filter(o => o['PEDIDO']);
    return _json({ ok: true, rows: rows });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/** POST: confirmar entrega
 *  Body JSON: { secret, action: 'confirmar', row, data?, hora? }
 *  Se data/hora vazios, usa o horário atual do servidor.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== SHARED_SECRET) {
      return _json({ ok: false, error: 'Não autorizado' });
    }
    if (body.action !== 'confirmar') {
      return _json({ ok: false, error: 'Ação inválida' });
    }
    const row = Number(body.row);
    if (!row || row < 2) return _json({ ok: false, error: 'Linha inválida' });

    const sh = _sheet();
    const headers = _headers(sh);
    const colData = _colIndex(headers, 'ENTREGUE DATA');
    const colHora = _colIndex(headers, 'ENTREGUE HORA');

    const now = new Date();
    const data = body.data && String(body.data).trim()
      ? String(body.data).trim()
      : Utilities.formatDate(now, TIMEZONE, 'dd/MM/yy');
    const hora = body.hora && String(body.hora).trim()
      ? String(body.hora).trim()
      : Utilities.formatDate(now, TIMEZONE, 'HH:mm');

    sh.getRange(row, colData).setValue(data);
    sh.getRange(row, colHora).setValue(hora);

    return _json({ ok: true, row: row, data: data, hora: hora });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
