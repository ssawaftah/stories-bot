// ====================================================================
// ========== التخزين المؤقت ==========
// ====================================================================

let data = {
  users: { pending: {}, rejected: {}, approved: {} },
  settings: {
    isActive: true,  // ✅ تم تغييرها إلى true
    stopMessage: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.',
    botLink: 'https://t.me/teeeesrydtbot?start=default',
    logChannel: 'ineswangelogs',
    stats: { todayUsers: 0, newUsersToday: 0, totalMessages: 0, sessions: 0 }
  },
  welcome: {
    enabled: true,
    text: '🎉 مرحباً بك في البوت!\n\n🔍 ابحث عن محتوى عبر إرسال رقم المحتوى.',
    buttons: [
      { text: '🔍 البحث عن محتوى', action: 'search' },
      { text: 'ℹ️ عن البوت', action: 'about' }
    ]
  },
  commands: {
    list: [
      { command: 'start', description: 'بدء استخدام البوت', enabled: true, builtin: true },
      { command: 'help', description: 'الحصول على المساعدة', enabled: true, builtin: true },
      { command: 'about', description: 'معلومات عن البوت', enabled: true, builtin: true },
      { command: 'search', description: 'البحث عن محتوى', enabled: true, builtin: true }
    ],
    custom: {}
  },
  content: { items: {} },
  verification: { enabled: false, type: 'phone', messages: {}, verifiedUsers: {}, pendingVerifications: {}, mathQuestions: {} },
  protection: { enabled: false, excludeMedia: false, excludeLinks: false, excludeText: false },
  notifications: { joinNotification: false, banNotification: false }
};

const adminState = { currentAction: null, step: null, tempData: {} };
const KV_KEYS = {
  USERS: 'bot_users', CONTENT: 'bot_content', SETTINGS: 'bot_settings',
  WELCOME: 'bot_welcome', COMMANDS: 'bot_commands', VERIFICATION: 'bot_verification',
  PROTECTION: 'bot_protection', NOTIFICATIONS: 'bot_notifications', STATS: 'bot_stats'
};

// ====================================================================
// ========== دوال KV ==========
// ====================================================================

async function loadAllData(env) {
  try {
    const usersData = await env.KV_NAMESPACE.get(KV_KEYS.USERS, 'json');
    if (usersData) data.users = usersData;
    const settingsData = await env.KV_NAMESPACE.get(KV_KEYS.SETTINGS, 'json');
    if (settingsData) {
      data.settings = { ...data.settings, ...settingsData };
      // التأكد من isActive = true إذا لم يكن محدداً
      if (data.settings.isActive === undefined) data.settings.isActive = true;
    }
    const welcomeData = await env.KV_NAMESPACE.get(KV_KEYS.WELCOME, 'json');
    if (welcomeData) data.welcome = welcomeData;
    const commandsData = await env.KV_NAMESPACE.get(KV_KEYS.COMMANDS, 'json');
    if (commandsData) {
      // دمج الأوامر المدمجة مع البيانات المحفوظة
      const savedCommands = commandsData.list || [];
      const builtinCommands = [
        { command: 'start', description: 'بدء استخدام البوت', builtin: true },
        { command: 'help', description: 'الحصول على المساعدة', builtin: true },
        { command: 'about', description: 'معلومات عن البوت', builtin: true },
        { command: 'search', description: 'البحث عن محتوى', builtin: true }
      ];
      
      // دمج الأوامر: الاحتفاظ بالأوامر المدمجة مع إضافة الأوامر المخصصة
      const mergedList = builtinCommands.map(bc => {
        const saved = savedCommands.find(s => s.command === bc.command);
        return saved ? { ...bc, ...saved } : bc;
      });
      
      // إضافة الأوامر المخصصة (غير المدمجة)
      const customCommands = savedCommands.filter(s => !builtinCommands.find(b => b.command === s.command));
      
      data.commands.list = [...mergedList, ...customCommands];
      data.commands.custom = commandsData.custom || {};
    }
    const verData = await env.KV_NAMESPACE.get(KV_KEYS.VERIFICATION, 'json');
    if (verData) data.verification = verData;
    const protData = await env.KV_NAMESPACE.get(KV_KEYS.PROTECTION, 'json');
    if (protData) data.protection = protData;
    const notData = await env.KV_NAMESPACE.get(KV_KEYS.NOTIFICATIONS, 'json');
    if (notData) data.notifications = notData;
    const statsData = await env.KV_NAMESPACE.get(KV_KEYS.STATS, 'json');
    if (statsData) data.settings.stats = statsData;
    const contentData = await env.KV_NAMESPACE.get(KV_KEYS.CONTENT, 'json');
    if (contentData) data.content = contentData;
    console.log('✅ All data loaded');
  } catch (error) { console.error('Error loading data:', error); }
}

async function saveAllData(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.USERS, JSON.stringify(data.users));
    await env.KV_NAMESPACE.put(KV_KEYS.SETTINGS, JSON.stringify(data.settings));
    await env.KV_NAMESPACE.put(KV_KEYS.WELCOME, JSON.stringify(data.welcome));
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify({ list: data.commands.list, custom: data.commands.custom }));
    await env.KV_NAMESPACE.put(KV_KEYS.VERIFICATION, JSON.stringify(data.verification));
    await env.KV_NAMESPACE.put(KV_KEYS.PROTECTION, JSON.stringify(data.protection));
    await env.KV_NAMESPACE.put(KV_KEYS.NOTIFICATIONS, JSON.stringify(data.notifications));
    await env.KV_NAMESPACE.put(KV_KEYS.STATS, JSON.stringify(data.settings.stats));
    await env.KV_NAMESPACE.put(KV_KEYS.CONTENT, JSON.stringify(data.content));
  } catch (error) { console.error('Error saving data:', error); }
}

// ====================================================================
// ========== دوال مساعدة ==========
// ====================================================================

async function sendMessage(chatId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown', ...options };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await response.json();
  } catch (error) { console.error('Error sending message:', error); return { ok: false }; }
}

async function editMessage(chatId, messageId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const payload = { chat_id: chatId, message_id: messageId, text: text, parse_mode: 'Markdown', ...options };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await response.json();
  } catch (error) { console.error('Error editing message:', error); return { ok: false }; }
}

async function answerCallbackQuery(callbackId, text, token) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: callbackId, text: text || '✅ تم' }) });
  } catch (error) { console.error('Error answering callback:', error); }
}

async function sendLog(message, token) {
  const logChannel = data.settings.logChannel;
  if (!logChannel) return;
  try { await sendMessage(logChannel, message, token); } catch (error) { console.error('Error sending log:', error); }
}

async function logUserAction(userId, username, action, details, token) {
  const timestamp = new Date().toLocaleString('ar-EG');
  const userDisplay = username ? `@${username}` : `ID: ${userId}`;
  await sendLog(`📋 سجل الإجراءات\n\n👤 المستخدم: ${userDisplay}\n🆔 المعرف: ${userId}\n⚡ الإجراء: ${action}\n📝 التفاصيل: ${details}\n🕐 الوقت: ${timestamp}`, token);
}

function generateContentId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// ====================================================================
// ========== دوال رسالة الترحيب والأوامر ==========
// ====================================================================

function getWelcomeMenu() {
  const welcome = data.welcome;
  const buttons = welcome.buttons.map(b => [{ text: b.text, callback_data: `welcome_btn_${b.action}` }]);
  return {
    text: welcome.text,
    keyboard: { inline_keyboard: buttons }
  };
}

function getWelcomeSettingsMenu() {
  const welcome = data.welcome;
  const status = welcome.enabled ? '🟢 مفعلة' : '🔴 معطلة';
  const buttonsText = welcome.buttons.map(b => `• ${b.text} (${b.action})`).join('\n');
  
  const text = `
✏️ **إعدادات رسالة الترحيب**

📌 **الحالة:** ${status}

📝 **نص الرسالة:**
${welcome.text}

🔘 **الأزرار:**
${buttonsText || 'لا توجد أزرار'}

🔹 اختر الإجراء:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🔄 ${welcome.enabled ? 'تعطيل' : 'تفعيل'} الرسالة`, callback_data: 'welcome
