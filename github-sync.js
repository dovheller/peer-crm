// =============================================
// PEER CRM v5 · GitHub Sync + WhatsApp Module
// =============================================

// ========== GITHUB API CLIENT ==========
async function ghApiCall(method, path, body = null) {
  const cfg = window.PEER_CONFIG;
  const url = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/${path}`;
  const headers = {
    'Authorization': `Bearer ${cfg.github_token}`,
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
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

// ========== INIT ==========
async function initGitHubSync() {
  const cfg = window.PEER_CONFIG;
  if (!cfg) throw new Error('config.js לא נטען');
  if (cfg.github_token === 'YOUR_GITHUB_TOKEN_HERE') {
    showSetupModal();
    throw new Error('GitHub Token לא מוגדר');
  }
  // בדיקת חיבור
  try {
    await ghApiCall('GET', '');
    GH_CONFIG = cfg;
    console.log('✓ GitHub connection OK');
  } catch(err) {
    console.error('GitHub connection failed:', err);
    throw err;
  }
}

// ========== LOAD DATA ==========
async function loadDataFromGitHub() {
  showSyncStatus('טוען נתונים מ-GitHub...', 'syncing');
  const cfg = window.PEER_CONFIG;
  const result = await ghApiCall('GET', `contents/${cfg.data_file}`);
  DATA_SHA = result.sha;

  // GitHub מחזיר Base64 - יש לפענח ולתמוך ב-UTF-8 (עברית)
  const decoded = decodeURIComponent(escape(atob(result.content.replace(/\n/g, ''))));
  PEER_DATA = JSON.parse(decoded);
  window.PEER_DATA = PEER_DATA; // חשיפה לקוד הישן

  console.log(`✓ נטענו ${PEER_DATA._meta?.totalProperties || 0} נכסים מ-GitHub`);
  return PEER_DATA;
}

// ========== SAVE DATA ==========
async function saveDataToGitHub(commitMessage = 'Update from CRM') {
  if (!PEER_DATA) return;
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

// ========== SETUP MODAL ==========
function showSetupModal() {
  const modal = document.createElement('div');
  modal.className = 'gh-setup-modal';
  modal.innerHTML = `
    <div class="gh-setup">
      <h2>🔐 הגדרת חיבור ל-GitHub</h2>
      <p>כדי שהמערכת תשמור שינויים בענן, צריך להגדיר Personal Access Token פעם אחת.</p>
      <div class="step"><b>שלב 1:</b> היכנסי ל-<a href="https://github.com/settings/tokens?type=beta" target="_blank">GitHub Tokens</a></div>
      <div class="step"><b>שלב 2:</b> לחצי "Generate new token" → בחרי "Fine-grained" → תני שם "PEER CRM"</div>
      <div class="step"><b>שלב 3:</b> הגדירי תפוגה (90 ימים מומלץ) → תחת "Repository access" בחרי את ה-repo</div>
      <div class="step"><b>שלב 4:</b> תחת "Repository permissions" הפעילי <b>Contents: Read and write</b></div>
      <div class="step"><b>שלב 5:</b> לחצי "Generate" והעתיקי את ה-Token (מתחיל ב-<code>github_pat_</code>)</div>
      <p style="margin-top:14px"><b>הדרך הנכונה ביותר:</b> פתחי את הקובץ <code>config.js</code> במחשב, החליפי את <code>YOUR_GITHUB_TOKEN_HERE</code> ב-Token שלך, ושמרי את הקובץ.</p>
      <p>למידע מלא ראי את הקובץ <code>SETUP.md</code> ב-Repository.</p>
      <button class="btn btn-pri" onclick="this.closest('.gh-setup-modal').remove()">הבנתי, אסגור</button>
    </div>
  `;
  document.body.appendChild(modal);
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
