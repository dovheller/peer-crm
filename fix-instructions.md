# PEER CRM — תיקון באג "renderImport is not defined"

## הבעיה

המסך מציג שגיאה: `renderImport is not defined`. זה גורם למסך הראשי להישבר ולהציג רקע ריק.

## הסיבה

הקובץ `peer-crm-v3.html` קורא לפונקציה בשם `renderImport()` בכמה מקומות (לרוב מתוך כפתורי הניווט במובייל), אבל הפונקציה הזו לא הוגדרה בקובץ.

**ההסבר הסביר ביותר:** Claude Designer הוסיף את התצוגה למובייל (תפריט תחתון, כפתורים ניידים) בעיבוד אחר ממה ש-Claude (אני) ראה. בתפריט המובייל יש קישור למסך הייבוא שקורא ל-`renderImport()` במקום ל-`navTo('import')`.

## הפתרון — שני שלבים

### שלב 1: פתח את הקובץ peer-crm-v3.html בעורך טקסט

(Notepad, VSCode, Sublime Text — כל עורך)

### שלב 2: חפש את השורה הזו (קרוב לסוף הקובץ, סביבות שורה 2006)

```javascript
document.addEventListener('keydown',e=>{
```

### שלב 3: הוסף את השורות הבאות **לפני** השורה הזו:

```javascript
/* Safety patches — ensure all nav functions exist */
window.renderImport = window.renderImport || function(){ navTo('import'); };
window.renderNeighborhood = window.renderNeighborhood || function(){ navTo('neighborhood'); };
window.renderOverview = window.renderOverview || function(){ navTo('overview'); };
window.renderDatabase = window.renderDatabase || function(){ navTo('database'); };
window.renderPixel = window.renderPixel || function(){ navTo('pixel'); };
window.renderWhatsapp = window.renderWhatsapp || function(){ navTo('whatsapp'); };
window.renderLeads = window.renderLeads || function(){ navTo('leads'); renderLeads(); };
window.renderInternational = window.renderInternational || function(){ navTo('international'); };
window.renderExport = window.renderExport || function(){ navTo('export'); };
window.renderIntake = window.renderIntake || function(){ navTo('intake'); };
```

### שלב 4: שמור את הקובץ והעלה מחדש ל-GitHub Pages

### שלב 5: נקה Cache בדפדפן

במובייל: לחץ על "🔄" עם החזקה ארוכה → בחר "Hard refresh" או "Empty cache and hard reload".

או פשוט פתח את הדף ב-Incognito mode.

---

## פתרון אלטרנטיבי — אם אתה לא רוצה לערוך ידנית

תוכל לשלוח לי את הקובץ peer-crm-v3.html שעלה ל-GitHub Pages (שזה עם תפריט המובייל), ואני אבנה לך גרסה מתוקנת לחלוטין שתחליף את הקובץ הקיים.

## למה זה עובד

הפונקציות שאני יוצר הן "fallbacks" — אם הפונקציה האמיתית קיימת, היא נשארת. אם לא, היא מוחלפת בפונקציה שעושה את הדבר ההגיוני: לעבור למסך המתאים.

זה לא רק מתקן את הבאג הספציפי הזה, אלא **מחסן** את הקובץ נגד באגים דומים שעלולים להופיע בעתיד (אם Designer יוסיף עוד גרסה עם פונקציה לא מוגדרת).
