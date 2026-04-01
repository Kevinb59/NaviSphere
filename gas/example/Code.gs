/**
 * NaviSphere — backend Google Apps Script (à lier à la feuille source).
 * Feuille : ligne 1 = Alias | MDP | App1 … App24
 *
 * Déploiement : Application Web, exécuter en tant que : propriétaire, accès : Tous (ou restreint).
 */

// 1) Purpose:
// - Point d'entrée HTTP POST (JSON dans postData.contents).
// 2) Key variables:
// - `data.action`: register | login | setFavorites
// 3) Logic flow:
// - Parse JSON, route vers la fonction métier, renvoie du JSON (MIME JSON).
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'register') {
      return jsonOutput(registerUser_(sheet, data));
    }
    if (action === 'login') {
      return jsonOutput(loginUser_(sheet, data));
    }
    if (action === 'setFavorites') {
      return jsonOutput(setFavorites_(sheet, data));
    }
    return jsonOutput({ ok: false, error: 'ACTION_INCONNUE' });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 1) Purpose:
// - Lire le mot de passe que le client envoie sous `pwd` (proxy / WAF) ou `password` (ancien format).
// 2) Key variables: `data` = objet JSON du POST.
// 3) Logic flow: priorité `password`, sinon `pwd`, sinon chaîne vide.
function readPassword_(data) {
  return String(data.password || data.pwd || '');
}

function registerUser_(sheet, data) {
  var alias = String(data.alias || '').trim();
  var password = readPassword_(data);
  if (!alias || !password) return { ok: false, error: 'CHAMPS_MANQUANTS' };
  if (findUserRowIndex_(sheet, alias)) return { ok: false, error: 'ALIAS_EXISTE' };
  var row = [alias, password];
  for (var i = 0; i < 24; i++) row.push('');
  sheet.appendRow(row);
  return { ok: true, favorites: [] };
}

function loginUser_(sheet, data) {
  var alias = String(data.alias || '').trim();
  var password = readPassword_(data);
  var rowIndex = findUserRowIndex_(sheet, alias);
  if (!rowIndex) return { ok: false, error: 'UTILISATEUR_INCONNU' };
  var row = sheet.getRange(rowIndex, 1, rowIndex, 26).getValues()[0];
  if (String(row[1]) !== password) return { ok: false, error: 'MOT_DE_PASSE_INVALIDE' };
  return { ok: true, favorites: readFavoritesFromRow_(row) };
}

function setFavorites_(sheet, data) {
  var alias = String(data.alias || '').trim();
  var password = readPassword_(data);
  var favorites = data.favorites || [];
  if (!Array.isArray(favorites) || favorites.length > 24) return { ok: false, error: 'LISTE_INVALIDE' };
  var rowIndex = findUserRowIndex_(sheet, alias);
  if (!rowIndex) return { ok: false, error: 'UTILISATEUR_INCONNU' };
  var row = sheet.getRange(rowIndex, 1, rowIndex, 26).getValues()[0];
  if (String(row[1]) !== password) return { ok: false, error: 'MOT_DE_PASSE_INVALIDE' };
  var newRow = [row[0], row[1]];
  for (var i = 0; i < 24; i++) {
    newRow.push(favorites[i] ? String(favorites[i]).trim() : '');
  }
  sheet.getRange(rowIndex, 1, rowIndex, 26).setValues([newRow]);
  return { ok: true, favorites: readFavoritesFromRow_(newRow) };
}

function findUserRowIndex_(sheet, alias) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var colA = sheet.getRange(2, 1, last, 1).getValues();
  var lower = String(alias).toLowerCase();
  for (var r = 0; r < colA.length; r++) {
    if (String(colA[r][0]).trim().toLowerCase() === lower) return r + 2;
  }
  return 0;
}

function readFavoritesFromRow_(row) {
  var out = [];
  for (var c = 2; c < 2 + 24; c++) {
    var v = row[c];
    if (v && String(v).trim()) out.push(String(v).trim());
  }
  return out;
}
