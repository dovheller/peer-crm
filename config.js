// =============================================
// PEER CRM v5 · קובץ הגדרות (בטוח לפרסום)
// =============================================
// קובץ זה מכיל רק הגדרות לא-סודיות.
// ה-Token עצמו נשמר במכשיר של אסתי (localStorage)
// ולא בקובץ הזה - בטוח לפרסום ב-GitHub Public.
// =============================================

window.PEER_CONFIG = {
  // שם המשתמש שלך ב-GitHub (לדוגמה: "esti-heller")
  github_owner: "dovheller",

  // שם ה-Repository (לדוגמה: "peer-crm")
  github_repo: "peer-crm",

  // ענף - השאירי "main"
  github_branch: "main",

  // נתיב הקובץ ב-Repository
  data_file: "data.json",

  // ⚠️ ה-Token *לא* נשמר כאן - הוא נשמר ב-localStorage של הדפדפן
  // בפעם הראשונה שהאפליקציה רצה היא תבקש ממך אותו פעם אחת.

  // הגדרות נוספות
  auto_save_seconds: 30,        // שמירה אוטומטית כל X שניות
  esti_phone: "972552740050",   // מספר WhatsApp של אסתי (ללא +)
  show_debug: false             // להצגת שגיאות מפורטות במסך
};
