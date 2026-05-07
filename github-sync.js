// =============================================
// PEER CRM v5 · GitHub Sync + WhatsApp Module
// Token נשמר ב-localStorage של הדפדפן (לא בקובץ ציבורי)
// =============================================

const TOKEN_KEY = 'peer_crm_github_token';

// ========== TOKEN MANAGEMENT ==========
function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ========== GITHUB API CLIENT ==========
async function ghApiCall(method, path, body = null) {
  const cfg = window.PEER_CONFIG;
  const token = getStoredToken();
  if (!token) throw new Error('NO_TOKEN');

  const url = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      clearStoredToken();
      throw new Error('TOKEN_INVALID');
    }
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

// ========== INIT ==========
async function initGitHubSync() {
  const cfg = window.PEER_CONFIG;
  if (!cfg) throw new Error('config.js לא נטען');
  if (!cfg.github_owner || cfg.github_owner === 'YOUR_GITHUB_USERNAME') {
    throw new Error('CONFIG_INCOMPLETE');
  }

  // אין צורך ב-Token לטעינה - רק לשמירה
  // אם יש Token שמור, נבדוק שהוא תקף
  let token = getStoredToken();
  if (token) {
    try {
      await ghApiCall('GET', '');
      console.log('✓ GitHub Token תקף - שמירה זמינה');
    } catch(err) {
      if (err.message === 'TOKEN_INVALID') {
        console.warn('Token פג תוקף - תידרשי להזין חדש לפני שמירה');
      }
    }
  } else {
    console.log('אין Token - מצב קריאה בלבד. הזיני Token דרך ההגדרות לאפשר שמירה.');
  }
}

// ========== TOKEN PROMPT MODAL ==========
function promptForToken(message = 'הכניסי את ה-Personal Access Token של GitHub:') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'gh-setup-modal';
    modal.innerHTML = `
      <div class="gh-setup">
        <h2>🔐 חיבור ל-GitHub</h2>
        <p>${message}</p>
        <p style="font-size:12px">צריכה Token? <a href="https://github.com/settings/tokens?type=beta" target="_blank" style="color:var(--gold);text-decoration:underline">לחצי כאן ליצירה</a> (פעם אחת בלבד)</p>

        <label>Personal Access Token</label>
        <input type="password" id="gh-token-input" placeholder="github_pat_..." autocomplete="off" />
        <p style="font-size:11px;color:var(--ink-faint);margin-top:6px">הטוקן יישמר במכשיר הזה בלבד. לא יישלח לאף מקום אחר.</p>

        <details style="margin-top:14px;font-size:12px">
          <summary style="cursor:pointer;font-weight:600;color:var(--gold)">איך מקבלים Token?</summary>
          <div class="step"><b>שלב 1:</b> לחצי <a href="https://github.com/settings/tokens?type=beta" target="_blank">כאן</a> ליצירת Token חדש</div>
          <div class="step"><b>שלב 2:</b> Token name: "PEER CRM"</div>
          <div class="step"><b>שלב 3:</b> Expiration: 90 days</div>
          <div class="step"><b>שלב 4:</b> Repository access: Only select repos → בחרי <code>peer-crm</code></div>
          <div class="step"><b>שלב 5:</b> Repository permissions → Contents: <b>Read and write</b></div>
          <div class="step"><b>שלב 6:</b> Generate token → העתיקי והדביקי כאן</div>
        </details>

        <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
          <button class="btn" id="gh-cancel">ביטול</button>
          <button class="btn btn-pri" id="gh-save">חבר</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#gh-token-input');
    input.focus();

    modal.querySelector('#gh-save').onclick = () => {
      const val = input.value.trim();
      if (!val) {
        input.style.borderColor = 'var(--danger)';
        return;
      }
      modal.remove();
      resolve(val);
    };
    modal.querySelector('#gh-cancel').onclick = () => {
      modal.remove();
      resolve(null);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') modal.querySelector('#gh-save').click();
    });
  });
}

// ========== LOAD DATA ==========
// אסטרטגיה: קודם לנסות לטעון כקובץ סטטי (חינם, מהיר, בלי Token)
// אם זה נכשל - לנסות דרך ה-API (דורש Token, עובד גם ל-Repos פרטיים)
async function loadDataFromGitHub() {
  showSyncStatus('טוען נתונים...', 'syncing');
  const cfg = window.PEER_CONFIG;

  // ניסיון 1: טעינה כקובץ סטטי (העדפה - אין צורך ב-Token)
  try {
    // הוסף timestamp כדי לעקוף cache
    const staticUrl = `${cfg.data_file}?t=${Date.now()}`;
    const res = await fetch(staticUrl);
    if (res.ok) {
      PEER_DATA = await res.json();
      window.PEER_DATA = PEER_DATA;
      console.log(`✓ נטענו ${PEER_DATA._meta?.totalProperties || 0} נכסים (קובץ סטטי)`);

      // נטען את ה-SHA ברקע אם יש Token (לכתיבה עתידית)
      if (getStoredToken()) {
        try {
          const apiResult = await ghApiCall('GET', `contents/${cfg.data_file}`);
          DATA_SHA = apiResult.sha;
        } catch(e) {
          console.warn('Could not fetch SHA - saves disabled until login');
        }
      }
      return PEER_DATA;
    }
  } catch(e) {
    console.warn('Static load failed, trying API:', e.message);
  }

  // ניסיון 2: טעינה דרך ה-API (דורש Token)
  if (!getStoredToken()) {
    throw new Error('לא ניתן לטעון את data.json. ודא שהקובץ קיים ב-Repository.');
  }
  const result = await ghApiCall('GET', `contents/${cfg.data_file}`);
  DATA_SHA = result.sha;
  const decoded = decodeURIComponent(escape(atob(result.content.replace(/\n/g, ''))));
  PEER_DATA = JSON.parse(decoded);
  window.PEER_DATA = PEER_DATA;
  console.log(`✓ נטענו ${PEER_DATA._meta?.totalProperties || 0} נכסים (API)`);
  return PEER_DATA;
}

// ========== SAVE DATA ==========
async function saveDataToGitHub(commitMessage = 'Update from CRM') {
  if (!PEER_DATA) return;

  // וודא שיש Token לפני שמירה
  let token = getStoredToken();
  if (!token) {
    token = await promptForToken('כדי לשמור שינויים ב-GitHub, צריך להזין Token פעם אחת:');
    if (!token) {
      showSyncStatus('שמירה בוטלה', 'warning');
      return false;
    }
    setStoredToken(token);
    // צריך לטעון את ה-SHA אם זה הפעם הראשונה
    if (!DATA_SHA) {
      const cfg = window.PEER_CONFIG;
      try {
        const apiResult = await ghApiCall('GET', `contents/${cfg.data_file}`);
        DATA_SHA = apiResult.sha;
      } catch(e) {
        showSyncStatus('שגיאה: ' + e.message, 'error');
        return false;
      }
    }
  }

  showSyncStatus('שומר ל-GitHub...', 'syncing');

  const cfg = window.PEER_CONFIG;
  // עדכן את התאריך ב-meta
  if (PEER_DATA._meta) {
    PEER_DATA._meta.lastUpdated = new Date().toISOString();
  }

  // קוד את ה-JSON ל-Base64 (תומך עברית)
  const json = JSON.stringify(PEER_DATA, null, 2);
  const encoded = btoa(unescape(encodeURIComponent(json)));

  try {
    const result = await ghApiCall('PUT', `contents/${cfg.data_file}`, {
      message: commitMessage,
      content: encoded,
      sha: DATA_SHA,
      branch: cfg.github_branch
    });
    DATA_SHA = result.content.sha;
    pendingChanges = false;
    showSyncStatus('✓ נשמר', 'success');
    console.log('✓ נשמר ל-GitHub');
    return true;
  } catch(err) {
    if (err.message.includes('409')) {
      // קונפליקט - מישהו אחר שמר באמצע
      showSyncStatus('⚠ קונפליקט - טוען מחדש...', 'warning');
      await loadDataFromGitHub();
      showSyncStatus('⚠ הנתונים התעדכנו - נסה שוב', 'warning');
      return false;
    }
    showSyncStatus('✗ שגיאה בשמירה', 'error');
    console.error(err);
    throw err;
  }
}

// ========== AUTO SAVE ==========
function markChanged(reason = 'change') {
  pendingChanges = true;
  showSyncStatus('● שינויים לא נשמרו', 'warning');
  if (saveTimer) clearTimeout(saveTimer);
  const seconds = window.PEER_CONFIG?.auto_save_seconds || 30;
  saveTimer = setTimeout(() => {
    if (pendingChanges) saveDataToGitHub(`Auto-save: ${reason}`);
  }, seconds * 1000);
}

// שמירה ידנית מיידית
async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  return await saveDataToGitHub('Manual save by Esti');
}

// אזהרה לפני סגירת הדף עם שינויים לא שמורים
window.addEventListener('beforeunload', (e) => {
  if (pendingChanges) {
    e.preventDefault();
    e.returnValue = 'יש שינויים לא שמורים. אם תצאי, הם יאבדו.';
  }
});

// ========== SYNC STATUS UI ==========
function showSyncStatus(msg, type = 'success') {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.className = 'sync-status ' + type;
  el.innerHTML = (type === 'syncing' ? '<span class="pulse"></span> ' : '') + msg;
  if (type === 'success') {
    setTimeout(() => {
      if (!pendingChanges) el.innerHTML = '✓ מסונכרן';
    }, 3000);
  }
}

// ========== WHATSAPP HELPERS ==========
// פתיחת WhatsApp עם אסתי (משמש את ה-CTA הראשי בדף)
function openWhatsAppEsti(prefilledText = '') {
  const phone = window.PEER_CONFIG?.esti_phone || '972552740050';
  const text = encodeURIComponent(prefilledText);
  const url = `https://wa.me/${phone}${text ? '?text=' + text : ''}`;
  window.open(url, '_blank');
}

// פתיחת WhatsApp עם ליד ספציפי
function openWhatsAppLead(leadId) {
  if (!PEER_DATA?.leads) return;
  const lead = PEER_DATA.leads.find(l => l.id === leadId);
  if (!lead) {
    alert('הליד לא נמצא');
    return;
  }
  const greeting = `היי ${lead.n}, מדברת אסתי הלר מ-PEER נדל"ן יוקרה. `;
  const text = encodeURIComponent(greeting);
  const url = `https://wa.me/${lead.phoneClean}?text=${text}`;
  window.open(url, '_blank');

  // לוג השיחה
  if (!lead.contactLog) lead.contactLog = [];
  lead.contactLog.push({
    type: 'whatsapp_initiated',
    when: new Date().toISOString()
  });
  lead.last = 'היום';
  markChanged(`WhatsApp ל-${lead.n}`);
}

// פתיחת WhatsApp עם נכס - טקסט מוכן עם פרטים
function openWhatsAppForProperty(prop) {
  let text = `שלום, ראיתי את הנכס שלך:\n\n`;
  if (prop.addr) text += `📍 ${prop.addr}`;
  if (prop.nbh) text += `, ${prop.nbh}`;
  text += '\n';
  if (prop.rooms) text += `🛏 ${prop.rooms} חדרים\n`;
  if (prop.m2) text += `📐 ${prop.m2} מ"ר\n`;
  if (prop.price) text += `💰 ₪${prop.price.toLocaleString('he-IL')}\n`;
  text += '\nאשמח לפרטים נוספים. תודה!';
  openWhatsAppEsti(text);
}

// ========== TOKEN MANAGEMENT UI ==========
async function changeGitHubToken() {
  const newToken = await promptForToken('הכניסי Token חדש:');
  if (newToken) {
    setStoredToken(newToken);
    location.reload();
  }
}

function logoutGitHub() {
  if (confirm('להתנתק? תצטרכי להזין שוב את ה-Token בכניסה הבאה.')) {
    clearStoredToken();
    location.reload();
  }
}

// ========== EXPORT TO WINDOW ==========
window.initGitHubSync = initGitHubSync;
window.loadDataFromGitHub = loadDataFromGitHub;
window.saveDataToGitHub = saveDataToGitHub;
window.saveNow = saveNow;
window.markChanged = markChanged;
window.showSyncStatus = showSyncStatus;
window.openWhatsAppEsti = openWhatsAppEsti;
window.openWhatsAppLead = openWhatsAppLead;
window.openWhatsAppForProperty = openWhatsAppForProperty;
window.changeGitHubToken = changeGitHubToken;
window.logoutGitHub = logoutGitHub;
