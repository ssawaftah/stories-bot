// ========== التخزين المؤقت ==========
let pendingUsers = {};
let rejectedUsers = {};
let approvedUsers = {};
let contentSystem = { items: {} };
let mandatorySubscription = { channels: [], groups: [], enabled: false };

// ========== إعدادات البوت المتقدمة ==========
let botSettings = {
  aboutText: '📌 بوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته',
  logChannel: 'ineswangelogs',
  isActive: true,
  stopMessage: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.',
  botLink: 'https://t.me/teeeesrydtbot?start=208119acf078c736aedc73397529c7796771993',
  usersList: [],
  totalMessages: 0,
  sessions: 0,
  stats: {
    todayUsers: 0,
    newUsersToday: 0,
    totalMessages: 0,
    sessions: 0
  }
};

// ========== نظام التحقق ==========
let verificationSystem = {
  enabled: false,
  type: 'phone', // 'phone', 'math', 'admin'
  messages: {
    success: '✅ تم التحقق بنجاح!',
    request: '🔐 يرجى التحقق من هويتك:',
    fail: '❌ فشل التحقق. حاول مرة أخرى.'
  },
  verifiedUsers: {},
  mathQuestion: null,
  mathAnswer: null
};

// ========== نظام حماية المحتوى ==========
let contentProtection = {
  enabled: false,
  excludeMedia: false,
  excludeLinks: false,
  excludeText: false
};

// ========== نظام الإشعارات ==========
let notificationSettings = {
  joinNotification: false,
  banNotification: false
};

// ========== حالة الأدمن ==========
const adminState = {
  currentAction: null,
  step: null,
  tempData: {},
  currentMenu: 'main'
};

// ========== حالة المستخدم ==========
const userState = {};

// ========== أسماء مفاتيح KV ==========
const KV_KEYS = {
  USERS: 'bot_users',
  CONTENT: 'bot_content',
  SUBSCRIPTION: 'bot_subscription',
  SETTINGS: 'bot_settings',
  TEXTS: 'bot_texts',
  VERIFICATION: 'bot_verification',
  PROTECTION: 'bot_protection',
  NOTIFICATIONS: 'bot_notifications',
  STATS: 'bot_stats'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // تحديث إعدادات البوت من البيئة
    botSettings.logChannel = env.LOG_CHANNEL_ID || 'ineswangelogs';
    console.log('📢 قناة التسجيل:', botSettings.logChannel);
    
    // ===== تحميل البيانات من KV =====
    await loadAllData(env);
    
    if (url.pathname === '/') {
      return new Response('Bot is running!', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        await handleTelegramUpdate(body, env);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error: ' + error.message, { status: 500 });
      }
    }

    if (url.pathname === '/setwebhook') {
      const webhookUrl = `https://${url.hostname}/webhook`;
      const token = env.BOT_TOKEN;
      
      const response = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
      );
      
      const result = await response.json();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};

// ====================================================================
// ========== دوال تحميل وحفظ البيانات ==========
// ====================================================================

async function loadAllData(env) {
  try {
    // تحميل المستخدمين
    const usersData = await env.KV_NAMESPACE.get(KV_KEYS.USERS, 'json');
    if (usersData) {
      pendingUsers = usersData.pending || {};
      rejectedUsers = usersData.rejected || {};
      approvedUsers = usersData.approved || {};
    }

    // تحميل المحتوى
    const contentData = await env.KV_NAMESPACE.get(KV_KEYS.CONTENT, 'json');
    if (contentData) {
      contentSystem.items = contentData.items || {};
    }

    // تحميل الاشتراك الإجباري
    const subData = await env.KV_NAMESPACE.get(KV_KEYS.SUBSCRIPTION, 'json');
    if (subData) {
      mandatorySubscription = subData;
    }

    // تحميل الإعدادات
    const settingsData = await env.KV_NAMESPACE.get(KV_KEYS.SETTINGS, 'json');
    if (settingsData) {
      botSettings = { ...botSettings, ...settingsData };
    }

    // تحميل التحقق
    const verData = await env.KV_NAMESPACE.get(KV_KEYS.VERIFICATION, 'json');
    if (verData) {
      verificationSystem = verData;
    }

    // تحميل حماية المحتوى
    const protData = await env.KV_NAMESPACE.get(KV_KEYS.PROTECTION, 'json');
    if (protData) {
      contentProtection = protData;
    }

    // تحميل الإشعارات
    const notData = await env.KV_NAMESPACE.get(KV_KEYS.NOTIFICATIONS, 'json');
    if (notData) {
      notificationSettings = notData;
    }

    // تحميل الإحصائيات
    const statsData = await env.KV_NAMESPACE.get(KV_KEYS.STATS, 'json');
    if (statsData) {
      botSettings.stats = statsData;
    }

    console.log('✅ All data loaded from KV successfully');
  } catch (error) {
    console.error('Error loading data from KV:', error);
  }
}

async function saveAllData(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.USERS, JSON.stringify({ pending: pendingUsers, rejected: rejectedUsers, approved: approvedUsers }));
    await env.KV_NAMESPACE.put(KV_KEYS.CONTENT, JSON.stringify({ items: contentSystem.items }));
    await env.KV_NAMESPACE.put(KV_KEYS.SUBSCRIPTION, JSON.stringify(mandatorySubscription));
    await env.KV_NAMESPACE.put(KV_KEYS.SETTINGS, JSON.stringify(botSettings));
    await env.KV_NAMESPACE.put(KV_KEYS.VERIFICATION, JSON.stringify(verificationSystem));
    await env.KV_NAMESPACE.put(KV_KEYS.PROTECTION, JSON.stringify(contentProtection));
    await env.KV_NAMESPACE.put(KV_KEYS.NOTIFICATIONS, JSON.stringify(notificationSettings));
    await env.KV_NAMESPACE.put(KV_KEYS.STATS, JSON.stringify(botSettings.stats));
  } catch (error) {
    console.error('Error saving data to KV:', error);
  }
}

// ====================================================================
// ========== دوال التسجيل ==========
// ====================================================================

async function sendLog(message, token) {
  const logChannel = botSettings.logChannel;
  if (!logChannel) return;
  
  try {
    await sendMessage(logChannel, message, token);
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

async function logUserAction(userId, username, action, details, token) {
  const timestamp = new Date().toLocaleString('ar-EG');
  const userDisplay = username ? `@${username}` : `ID: ${userId}`;
  
  const logMessage = `
📋 سجل الإجراءات

👤 المستخدم: ${userDisplay}
🆔 المعرف: ${userId}
⚡ الإجراء: ${action}
📝 التفاصيل: ${details}
🕐 الوقت: ${timestamp}
─────────────────`;

  await sendLog(logMessage, token);
}

// ====================================================================
// ========== دوال النصوص ==========
// ====================================================================

const defaultTexts = {
  user: {
    welcome: '🎉 مرحباً بك في البوت!\n\n🔍 ابحث عن محتوى عبر إرسال رقم المحتوى.\n📌 أو استخدم الأزرار أدناه:',
    search_prompt: 'أرسل رقم المحتوى الذي تريد مشاهدته:',
    about: '📌 بوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته',
    no_content: '❌ لا يوجد محتوى برقم {contentId}',
    choose_action: 'اختر الإجراء:',
    back_to_menu: '🔙 رجوع',
    search_button: '🔍 البحث عن محتوى',
    about_button: 'ℹ️ عن البوت',
    bot_stopped: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.',
    verification_request: '🔐 يرجى التحقق من هويتك:',
    verification_success: '✅ تم التحقق بنجاح!',
    verification_fail: '❌ فشل التحقق. حاول مرة أخرى.'
  },
  admin: {
    back: '🔙 رجوع',
    cancel: '🔙 إلغاء'
  }
};

let textSystem = defaultTexts;

function getText(category, key, replacements = {}) {
  let text = textSystem[category]?.[key] || key;
  for (const [placeholder, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  }
  return text;
}

function getUserText(key, replacements = {}) {
  return getText('user', key, replacements);
}

// ====================================================================
// ========== دوال الواجهة الرئيسية ==========
// ====================================================================

function getAdminMainMenu() {
  const stats = botSettings.stats;
  const text = `
📊 **لوحة تحكم البوت**

📈 **إحصائيات اليوم:**
👥 المستخدمين: ${Object.keys(approvedUsers).length}
🆕 المستخدمين الجدد: ${stats.newUsersToday || 0}
💬 عدد الرسائل الإجمالي: ${stats.totalMessages || 0}
📌 الجلسات: ${stats.sessions || 0}

🔹 **اختر الإجراء المناسب:**`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '⚙️ الإعدادات', callback_data: 'admin_settings' }],
      [{ text: '📋 إدارة الطلبات', callback_data: 'admin_requests' }],
      [{ text: '📦 إدارة المحتوى', callback_data: 'admin_content' }],
      [{ text: '📊 الإحصائيات', callback_data: 'admin_stats' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال الإعدادات ==========
// ====================================================================

function getSettingsMenu() {
  const text = `
⚙️ **الإعدادات**

إدارة إعدادات البوت الأساسية`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🤖 عمل البوت', callback_data: 'settings_bot' }],
      [{ text: '✅ التحقق من العضوية', callback_data: 'settings_verification' }],
      [{ text: '🔒 حماية المحتوى', callback_data: 'settings_protection' }],
      [{ text: '🔔 الإشعارات', callback_data: 'settings_notifications' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال عمل البوت ==========
// ====================================================================

function getBotSettingsMenu() {
  const status = botSettings.isActive ? '🟢 مفعل' : '🔴 متوقف';
  const usersCount = Object.keys(approvedUsers).length;
  
  const text = `
🤖 **إدارة حالة البوت**

🔗 **رابط الدخول:**
${botSettings.botLink}

👥 **المستخدمون:** ${usersCount}

📌 **حالة البوت:** ${status}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🤖 ${botSettings.isActive ? 'إيقاف' : 'تشغيل'} البوت`, callback_data: 'bot_toggle' }],
      [{ text: '📝 رسالة الإيقاف', callback_data: 'bot_stop_message' }],
      [{ text: '🔄 تغيير الرابط', callback_data: 'bot_change_link' }],
      [{ text: '🗑️ مسح قائمة المستخدمين', callback_data: 'bot_clear_users' }],
      [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال التحقق ==========
// ====================================================================

function getVerificationMenu() {
  const status = verificationSystem.enabled ? '🟢 مفعل' : '🔴 معطل';
  const typeMap = {
    phone: '📱 رقم الهاتف',
    math: '🧮 معادلة رياضية',
    admin: '👤 موافقة المشرف'
  };
  
  const text = `
✅ **التحقق من العضوية**

📌 **الحالة:** ${status}
📌 **نوع التحقق:** ${typeMap[verificationSystem.type] || 'غير محدد'}

🔹 اختر الإجراء:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🔄 ${verificationSystem.enabled ? 'تعطيل' : 'تفعيل'} التحقق`, callback_data: 'verif_toggle' }],
      [{ text: '📝 نوع التحقق', callback_data: 'verif_type' }],
      [{ text: '✏️ رسائل التحقق', callback_data: 'verif_messages' }],
      [{ text: '👥 الأعضاء المتحققين', callback_data: 'verif_users' }],
      [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
    ]
  };

  return { text, keyboard };
}

function getVerificationTypeMenu() {
  const types = [
    { text: '📱 رقم الهاتف', data: 'verif_type_phone' },
    { text: '🧮 معادلة رياضية', data: 'verif_type_math' },
    { text: '👤 موافقة المشرف', data: 'verif_type_admin' }
  ];
  
  const buttons = types.map(t => [{ text: t.text + (verificationSystem.type === t.text.includes('رقم') ? ' ✅' : t.text.includes('معادلة') && verificationSystem.type === 'math' ? ' ✅' : t.text.includes('مشرف') && verificationSystem.type === 'admin' ? ' ✅' : ''), callback_data: t.data }]);
  
  const text = `
📝 **اختر نوع التحقق:**

الحالي: ${verificationSystem.type}`;

  const keyboard = {
    inline_keyboard: [
      ...buttons,
      [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
    ]
  };

  return { text, keyboard };
}

function getVerificationMessagesMenu() {
  const text = `
✏️ **رسائل التحقق**

📌 **رسالة طلب التحقق:**
${verificationSystem.messages.request}

📌 **رسالة نجاح التحقق:**
${verificationSystem.messages.success}

📌 **رسالة فشل التحقق:**
${verificationSystem.messages.fail}

🔹 اختر الرسالة لتعديلها:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📝 رسالة الطلب', callback_data: 'verif_msg_request' }],
      [{ text: '✅ رسالة النجاح', callback_data: 'verif_msg_success' }],
      [{ text: '❌ رسالة الفشل', callback_data: 'verif_msg_fail' }],
      [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
    ]
  };

  return { text, keyboard };
}

function getVerifiedUsersMenu() {
  const users = Object.keys(verificationSystem.verifiedUsers);
  let text = `👥 **الأعضاء المتحققين**\n\n`;
  
  if (users.length === 0) {
    text += 'لا يوجد أعضاء متحققين.';
  } else {
    users.slice(0, 10).forEach(id => {
      const user = verificationSystem.verifiedUsers[id];
      text += `• ${user?.name || id}\n`;
    });
    if (users.length > 10) {
      text += `\n... و${users.length - 10} أعضاء آخرين`;
    }
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ إضافة مستخدم', callback_data: 'verif_user_add' }],
      [{ text: '🗑️ حذف مستخدم', callback_data: 'verif_user_remove' }],
      [{ text: '🗑️ حذف الكل', callback_data: 'verif_user_clear' }],
      [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال حماية المحتوى ==========
// ====================================================================

function getProtectionMenu() {
  const text = `
🔒 **حماية محتوى البوت**

تمنع المستخدمين من حفظ رسائل البوت وتوجيهها

📷 **استثناء الميديا:** ${contentProtection.excludeMedia ? '🟢 مفعل' : '🔴 معطل'}
🔗 **استثناء الروابط:** ${contentProtection.excludeLinks ? '🟢 مفعل' : '🔴 معطل'}
📝 **استثناء النصوص:** ${contentProtection.excludeText ? '🟢 مفعل' : '🔴 معطل'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🔒 ${contentProtection.enabled ? 'تعطيل' : 'تفعيل'} الحماية`, callback_data: 'protect_toggle' }],
      [{ text: `📷 استثناء الميديا: ${contentProtection.excludeMedia ? '✅' : '❌'}`, callback_data: 'protect_media' }],
      [{ text: `🔗 استثناء الروابط: ${contentProtection.excludeLinks ? '✅' : '❌'}`, callback_data: 'protect_links' }],
      [{ text: `📝 استثناء النصوص: ${contentProtection.excludeText ? '✅' : '❌'}`, callback_data: 'protect_text' }],
      [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال الإشعارات ==========
// ====================================================================

function getNotificationsMenu() {
  const text = `
🔔 **الإشعارات**

📌 **إشعار الدخول:** ${notificationSettings.joinNotification ? '🟢 مفعل' : '🔴 معطل'}
📌 **إشعار الحظر:** ${notificationSettings.banNotification ? '🟢 مفعل' : '🔴 معطل'}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🔔 إشعار الدخول: ${notificationSettings.joinNotification ? '✅' : '❌'}`, callback_data: 'notif_join' }],
      [{ text: `🚫 إشعار الحظر: ${notificationSettings.banNotification ? '✅' : '❌'}`, callback_data: 'notif_ban' }],
      [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== دوال إرسال الرسائل ==========
// ====================================================================

async function sendMessage(chatId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { 
    chat_id: chatId, 
    text: text, 
    parse_mode: 'Markdown',
    ...options 
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    return { ok: false };
  }
}

async function editMessage(chatId, messageId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    ...options
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error editing message:', error);
    return { ok: false };
  }
}

async function answerCallbackQuery(callbackId, text, token) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: text })
    });
  } catch (error) {
    console.error('Error answering callback:', error);
  }
}

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

async function handleTelegramUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN_ID = env.ADMIN_ID;

  try {
    // معالجة الكولباك (الأزرار)
    if (update.callback_query) {
      const query = update.callback_query;
      const userId = query.from.id;
      const data = query.data;
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;

      if (userId.toString() === ADMIN_ID) {
        await handleAdminCallback(data, chatId, messageId, token, env);
        await answerCallbackQuery(query.id, '✅ تم', token);
        return;
      }
      return;
    }

    // معالجة الرسائل
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;

      // ========== واجهة الأدمن ==========
      if (userId.toString() === ADMIN_ID) {
        if (text === '/start' || text === '/admin') {
          const menu = getAdminMainMenu();
          await sendMessage(chatId, menu.text, token, { reply_markup: menu.keyboard });
          return;
        }
        return;
      }

      // ========== واجهة المستخدم ==========
      // التحقق من حالة البوت
      if (!botSettings.isActive) {
        await sendMessage(chatId, botSettings.stopMessage, token);
        return;
      }

      // التحقق من المستخدم
      if (rejectedUsers[userId]) {
        await sendMessage(chatId, '❌ طلبك مرفوض.', token);
        return;
      }

      // معالجة /start للمستخدمين
      if (text === '/start') {
        if (approvedUsers[userId]) {
          // تحديث الإحصائيات
          botSettings.stats.sessions = (botSettings.stats.sessions || 0) + 1;
          await saveAllData(env);
          
          await showUserMainMenu(chatId, token);
          return;
        }

        if (pendingUsers[userId]) {
          await sendMessage(chatId, '⏳ طلبك قيد المراجعة...', token);
          return;
        }

        // طلب رقم الهاتف
        await sendMessage(chatId, '🔐 شارك رقم هاتفك للتحقق:', token, {
          reply_markup: {
            keyboard: [[{ text: '📱 مشاركة الرقم', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }

      // معالجة رقم الهاتف
      if (msg.contact) {
        const contact = msg.contact;
        if (contact.user_id !== userId) {
          await sendMessage(chatId, '❌ يرجى مشاركة رقمك الخاص!', token);
          return;
        }

        if (rejectedUsers[userId] || approvedUsers[userId]) {
          await sendMessage(chatId, '⚠️ تم معالجة طلبك مسبقاً', token);
          return;
        }

        const userData = {
          id: userId,
          username: msg.from.username || 'لا يوجد',
          name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
          phone: contact.phone_number,
          time: new Date().toLocaleString('ar-EG')
        };

        pendingUsers[userId] = userData;
        botSettings.stats.newUsersToday = (botSettings.stats.newUsersToday || 0) + 1;
        await saveAllData(env);

        await sendMessage(chatId, '⏳ تم استلام طلبك! جاري التحقق...', token);
        
        const adminMsg = `📢 طلب انضمام جديد!\n👤 ${userData.name}\n🆔 @${userData.username}`;
        await sendMessage(ADMIN_ID, adminMsg, token);
        return;
      }

      // معالجة البحث عن محتوى
      if (approvedUsers[userId]) {
        // تحديث الإحصائيات
        botSettings.stats.totalMessages = (botSettings.stats.totalMessages || 0) + 1;
        await saveAllData(env);
        
        await handleUserSearch(chatId, text, token, userId);
        return;
      }

      await sendMessage(chatId, '🔐 يرجى مشاركة رقم هاتفك أولاً.\nاضغط /start', token);
    }
  } catch (error) {
    console.error('Error in handleTelegramUpdate:', error);
  }
}

// ====================================================================
// ========== دوال المستخدم ==========
// ====================================================================

async function showUserMainMenu(chatId, token) {
  const text = getUserText('welcome');
  
  const keyboard = {
    keyboard: [
      [getUserText('search_button')],
      [getUserText('about_button')]
    ],
    resize_keyboard: true
  };

  await sendMessage(chatId, text, token, { reply_markup: keyboard });
}

async function handleUserSearch(chatId, text, token, userId) {
  // معالجة الأزرار
  if (text === getUserText('search_button')) {
    await sendMessage(chatId, getUserText('search_prompt'), token, {
      reply_markup: {
        keyboard: [[getUserText('back_to_menu')]],
        resize_keyboard: true
      }
    });
    return;
  }

  if (text === getUserText('about_button')) {
    await sendMessage(chatId, getUserText('about'), token);
    return;
  }

  if (text === getUserText('back_to_menu')) {
    await showUserMainMenu(chatId, token);
    return;
  }

  // البحث عن محتوى
  const contentId = text.trim();
  const item = contentSystem.items[contentId];
  
  if (item) {
    await sendContent(chatId, item, token);
  } else {
    await sendMessage(chatId, getUserText('no_content', { contentId }), token);
  }
}

async function sendContent(chatId, item, token) {
  // تطبيق حماية المحتوى
  const protection = contentProtection;
  let content = item.content;
  
  if (protection.enabled) {
    // حماية المحتوى
    if (protection.excludeMedia && (item.type === 'image' || item.type === 'video')) {
      // استثناء الميديا
    } else if (protection.excludeLinks && content.includes('http')) {
      // استثناء الروابط
    } else if (protection.excludeText && item.type === 'text') {
      // استثناء النصوص
    } else {
      // تطبيق الحماية (إضافة علامات مائية أو تحذيرات)
      content = `🔒 **محتوى محمي**\n\n${content}`;
    }
  }

  // إرسال المحتوى
  if (item.fileId && (item.type === 'video' || item.type === 'animation')) {
    await sendVideo(chatId, item.fileId, content, token);
  } else if (item.fileId && item.type === 'image') {
    await sendPhoto(chatId, item.fileId, content, token);
  } else {
    await sendMessage(chatId, content, token);
  }
}

// ====================================================================
// ========== دوال إرسال الوسائط ==========
// ====================================================================

async function sendVideo(chatId, fileId, caption, token) {
  const url = `https://api.telegram.org/bot${token}/sendVideo`;
  const payload = { chat_id: chatId, video: fileId, caption: caption, parse_mode: 'Markdown' };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending video:', error);
  }
}

async function sendPhoto(chatId, fileId, caption, token) {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const payload = { chat_id: chatId, photo: fileId, caption: caption, parse_mode: 'Markdown' };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending photo:', error);
  }
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(data, chatId, messageId, token, env) {
  // ===== القائمة الرئيسية =====
  if (data === 'admin_back') {
    const menu = getAdminMainMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'admin_settings') {
    const menu = getSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'settings_back') {
    const menu = getSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== عمل البوت =====
  if (data === 'settings_bot') {
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'bot_toggle') {
    botSettings.isActive = !botSettings.isActive;
    await saveAllData(env);
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await answerCallbackQuery(messageId, `✅ تم ${botSettings.isActive ? 'تشغيل' : 'إيقاف'} البوت`, token);
    return;
  }

  if (data === 'bot_stop_message') {
    adminState.currentAction = 'edit_stop_message';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, `📝 أدخل رسالة الإيقاف الجديدة:\n\nالحالية: ${botSettings.stopMessage}`, token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء', callback_data: 'cancel' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  if (data === 'bot_change_link') {
    const newLink = `https://t.me/teeeesrydtbot?start=${Date.now()}`;
    botSettings.botLink = newLink;
    await saveAllData(env);
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, `✅ تم تغيير الرابط:\n${newLink}`, token);
    return;
  }

  if (data === 'bot_clear_users') {
    approvedUsers = {};
    rejectedUsers = {};
    pendingUsers = {};
    await saveAllData(env);
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '🗑️ تم مسح جميع المستخدمين', token);
    return;
  }

  // ===== التحقق =====
  if (data === 'settings_verification') {
    const menu = getVerificationMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_back') {
    const menu = getVerificationMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_toggle') {
    verificationSystem.enabled = !verificationSystem.enabled;
    await saveAllData(env);
    const menu = getVerificationMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_type') {
    const menu = getVerificationTypeMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_type_phone') {
    verificationSystem.type = 'phone';
    await saveAllData(env);
    const menu = getVerificationTypeMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_type_math') {
    verificationSystem.type = 'math';
    await saveAllData(env);
    const menu = getVerificationTypeMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_type_admin') {
    verificationSystem.type = 'admin';
    await saveAllData(env);
    const menu = getVerificationTypeMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_messages') {
    const menu = getVerificationMessagesMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_msg_request' || data === 'verif_msg_success' || data === 'verif_msg_fail') {
    const key = data === 'verif_msg_request' ? 'request' : data === 'verif_msg_success' ? 'success' : 'fail';
    adminState.currentAction = 'edit_verif_message';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId, key };
    await sendMessage(chatId, `📝 أدخل رسالة ${key === 'request' ? 'الطلب' : key === 'success' ? 'النجاح' : 'الفشل'} الجديدة:\n\nالحالية: ${verificationSystem.messages[key]}`, token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء', callback_data: 'cancel' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  if (data === 'verif_users') {
    const menu = getVerifiedUsersMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_user_clear') {
    verificationSystem.verifiedUsers = {};
    await saveAllData(env);
    const menu = getVerifiedUsersMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'verif_user_add' || data === 'verif_user_remove') {
    const action = data === 'verif_user_add' ? 'add' : 'remove';
    adminState.currentAction = `verif_user_${action}`;
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, `📝 أرسل ${action === 'add' ? 'ID أو اسم المستخدم للإضافة' : 'ID أو اسم المستخدم للحذف'}:`, token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء', callback_data: 'cancel' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // ===== حماية المحتوى =====
  if (data === 'settings_protection') {
    const menu = getProtectionMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'protect_toggle') {
    contentProtection.enabled = !contentProtection.enabled;
    await saveAllData(env);
    const menu = getProtectionMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'protect_media') {
    contentProtection.excludeMedia = !contentProtection.excludeMedia;
    await saveAllData(env);
    const menu = getProtectionMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'protect_links') {
    contentProtection.excludeLinks = !contentProtection.excludeLinks;
    await saveAllData(env);
    const menu = getProtectionMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'protect_text') {
    contentProtection.excludeText = !contentProtection.excludeText;
    await saveAllData(env);
    const menu = getProtectionMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== الإشعارات =====
  if (data === 'settings_notifications') {
    const menu = getNotificationsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'notif_join') {
    notificationSettings.joinNotification = !notificationSettings.joinNotification;
    await saveAllData(env);
    const menu = getNotificationsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'notif_ban') {
    notificationSettings.banNotification = !notificationSettings.banNotification;
    await saveAllData(env);
    const menu = getNotificationsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== إلغاء =====
  if (data === 'cancel') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
    return;
  }

  // ===== معالجة الإدخالات النصية =====
  if (adminState.currentAction === 'edit_stop_message' && adminState.step === 'waiting_input') {
    botSettings.stopMessage = data;
    await saveAllData(env);
    adminState.currentAction = null;
    adminState.step = null;
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث رسالة الإيقاف', token);
    return;
  }

  if (adminState.currentAction === 'edit_verif_message' && adminState.step === 'waiting_input') {
    const key = adminState.tempData.key;
    verificationSystem.messages[key] = data;
    await saveAllData(env);
    adminState.currentAction = null;
    adminState.step = null;
    const menu = getVerificationMessagesMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, `✅ تم تحديث رسالة ${key}`, token);
    return;
  }

  if (adminState.currentAction === 'verif_user_add' && adminState.step === 'waiting_input') {
    const userId = data;
    verificationSystem.verifiedUsers[userId] = { name: userId, verifiedAt: new Date().toISOString() };
    await saveAllData(env);
    adminState.currentAction = null;
    adminState.step = null;
    const menu = getVerifiedUsersMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, `✅ تم إضافة المستخدم ${userId}`, token);
    return;
  }

  if (adminState.currentAction === 'verif_user_remove' && adminState.step === 'waiting_input') {
    const userId = data;
    if (verificationSystem.verifiedUsers[userId]) {
      delete verificationSystem.verifiedUsers[userId];
      await saveAllData(env);
      const menu = getVerifiedUsersMenu();
      await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, `✅ تم حذف المستخدم ${userId}`, token);
    } else {
      await sendMessage(chatId, `❌ المستخدم ${userId} غير موجود`, token);
    }
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }
}

// أضف بقية الدوال (إدارة الطلبات، إدارة المحتوى، إلخ) من الكود السابق

console.log('✅ Bot is ready!');
