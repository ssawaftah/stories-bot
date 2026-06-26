// ====================================================================
// ========== التخزين المؤقت ==========
// ====================================================================

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
  stats: {
    todayUsers: 0,
    newUsersToday: 0,
    totalMessages: 0,
    sessions: 0
  }
};

// ========== نظام التحقق المتكامل ==========
let verificationSystem = {
  enabled: false,
  type: 'phone', // 'phone', 'math', 'admin'
  messages: {
    phone: {
      request: '🔐 للتحقق، يرجى مشاركة رقم هاتفك:',
      button: '📱 مشاركة الرقم',
      success: '✅ تم التحقق بنجاح! يمكنك الآن استخدام البوت.',
      fail: '❌ فشل التحقق. يرجى المحاولة مرة أخرى.'
    },
    math: {
      request: '🧮 للتحقق، يرجى حل المعادلة التالية:',
      success: '✅ إجابة صحيحة! تم التحقق بنجاح.',
      fail: '❌ إجابة خاطئة. يرجى المحاولة مرة أخرى.'
    },
    admin: {
      request: '👤 طلب التحقق قيد المراجعة من قبل المشرف.',
      success: '✅ تمت الموافقة على طلب التحقق!',
      fail: '❌ تم رفض طلب التحقق.'
    }
  },
  verifiedUsers: {},
  pendingVerifications: {},
  mathQuestions: {}
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
  VERIFICATION: 'bot_verification',
  PROTECTION: 'bot_protection',
  NOTIFICATIONS: 'bot_notifications',
  STATS: 'bot_stats'
};

// ====================================================================
// ========== النصوص الافتراضية ==========
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
    bot_stopped: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.'
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
// ========== دوال التصدير والاستيراد ==========
// ====================================================================

async function exportAllData(chatId, token) {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toLocaleString('ar-EG'),
    users: {
      pending: pendingUsers,
      rejected: rejectedUsers,
      approved: approvedUsers
    },
    content: contentSystem.items,
    subscription: mandatorySubscription,
    settings: botSettings,
    verification: verificationSystem,
    protection: contentProtection,
    notifications: notificationSettings,
    texts: textSystem
  };

  const jsonData = JSON.stringify(exportData, null, 2);
  
  if (jsonData.length > 4000) {
    const parts = jsonData.match(/[\s\S]{1,4000}/g) || [];
    await sendMessage(chatId, '📤 **تم تصدير البيانات بنجاح!**\n\n(البيانات مقسمة لأجزاء)', token);
    for (let i = 0; i < parts.length; i++) {
      await sendMessage(chatId, `📄 **الجزء ${i + 1}/${parts.length}:**\n\n<pre>${parts[i]}</pre>`, token, { parse_mode: 'HTML' });
    }
  } else {
    await sendMessage(chatId, `📤 **تم تصدير البيانات بنجاح!**\n\n<pre>${jsonData}</pre>`, token, { parse_mode: 'HTML' });
  }
}

async function importAllData(chatId, text, token, env) {
  try {
    const data = JSON.parse(text);
    
    if (!data.users || !data.content || !data.settings) {
      throw new Error('بيانات غير مكتملة');
    }

    pendingUsers = data.users.pending || {};
    rejectedUsers = data.users.rejected || {};
    approvedUsers = data.users.approved || {};
    contentSystem.items = data.content || {};
    mandatorySubscription = data.subscription || { channels: [], groups: [], enabled: false };
    botSettings = { ...botSettings, ...data.settings };
    if (data.verification) verificationSystem = data.verification;
    if (data.protection) contentProtection = data.protection;
    if (data.notifications) notificationSettings = data.notifications;
    if (data.texts) textSystem = data.texts;
    
    await saveAllData(env);
    await sendMessage(chatId, '✅ **تم استيراد البيانات بنجاح!**', token);
    await showAdminMainMenu(chatId, token);
  } catch (error) {
    console.error('Import error:', error);
    await sendMessage(chatId, '❌ **فشل استيراد البيانات.** تأكد من صحة التنسيق.', token);
  }
}

// ====================================================================
// ========== دوال KV ==========
// ====================================================================

async function loadAllData(env) {
  try {
    const usersData = await env.KV_NAMESPACE.get(KV_KEYS.USERS, 'json');
    if (usersData) {
      pendingUsers = usersData.pending || {};
      rejectedUsers = usersData.rejected || {};
      approvedUsers = usersData.approved || {};
    }

    const contentData = await env.KV_NAMESPACE.get(KV_KEYS.CONTENT, 'json');
    if (contentData) {
      contentSystem.items = contentData.items || {};
    }

    const subData = await env.KV_NAMESPACE.get(KV_KEYS.SUBSCRIPTION, 'json');
    if (subData) {
      mandatorySubscription = subData;
    }

    const settingsData = await env.KV_NAMESPACE.get(KV_KEYS.SETTINGS, 'json');
    if (settingsData) {
      botSettings = { ...botSettings, ...settingsData };
    }

    const verData = await env.KV_NAMESPACE.get(KV_KEYS.VERIFICATION, 'json');
    if (verData) {
      verificationSystem = verData;
    }

    const protData = await env.KV_NAMESPACE.get(KV_KEYS.PROTECTION, 'json');
    if (protData) {
      contentProtection = protData;
    }

    const notData = await env.KV_NAMESPACE.get(KV_KEYS.NOTIFICATIONS, 'json');
    if (notData) {
      notificationSettings = notData;
    }

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
// ========== دوال التحقق ==========
// ====================================================================

async function handleVerification(userId, chatId, token, env) {
  if (!verificationSystem.enabled) return true;
  if (verificationSystem.verifiedUsers[userId]) return true;
  
  const type = verificationSystem.type;
  
  if (type === 'phone') {
    const msg = verificationSystem.messages.phone;
    await sendMessage(chatId, msg.request, token, {
      reply_markup: {
        keyboard: [[{ text: msg.button, request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return false;
  }
  
  if (type === 'math') {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '*'];
    const op = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch(op) {
      case '+': answer = num1 + num2; break;
      case '-': answer = num1 - num2; break;
      case '*': answer = num1 * num2; break;
    }
    
    verificationSystem.mathQuestions[userId] = { num1, num2, op, answer };
    const msg = verificationSystem.messages.math;
    await sendMessage(chatId, `${msg.request}\n\n${num1} ${op} ${num2} = ?`, token);
    return false;
  }
  
  if (type === 'admin') {
    const msg = verificationSystem.messages.admin;
    await sendMessage(chatId, msg.request, token);
    
    const userData = {
      id: userId,
      username: await getUsername(userId, token) || 'لا يوجد',
      name: await getUserName(userId, token) || 'مستخدم',
      time: new Date().toLocaleString('ar-EG')
    };
    
    verificationSystem.pendingVerifications[userId] = userData;
    await saveAllData(env);
    
    const adminMsg = `
👤 **طلب تحقق جديد!**

🆔 **المعرف:** ${userId}
👤 **الاسم:** ${userData.name}
🆔 **اليوزرنيم:** @${userData.username}
🕐 **الوقت:** ${userData.time}

📌 **نوع التحقق:** موافقة المشرف`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ قبول', callback_data: `verif_admin_approve_${userId}` },
          { text: '❌ رفض', callback_data: `verif_admin_reject_${userId}` }
        ]
      ]
    };
    
    const ADMIN_ID = env.ADMIN_ID;
    await sendMessage(ADMIN_ID, adminMsg, token, { reply_markup: adminKeyboard });
    return false;
  }
  
  return true;
}

async function handleVerificationResponse(userId, chatId, text, token, env) {
  const type = verificationSystem.type;
  
  if (type === 'math') {
    const question = verificationSystem.mathQuestions[userId];
    if (!question) return false;
    
    const userAnswer = parseInt(text.trim());
    if (userAnswer === question.answer) {
      verificationSystem.verifiedUsers[userId] = {
        name: await getUserName(userId, token),
        method: 'math',
        verifiedAt: new Date().toISOString()
      };
      delete verificationSystem.mathQuestions[userId];
      await saveAllData(env);
      
      const msg = verificationSystem.messages.math;
      await sendMessage(chatId, msg.success, token);
      return true;
    } else {
      const msg = verificationSystem.messages.math;
      await sendMessage(chatId, msg.fail, token);
      await handleVerification(userId, chatId, token, env);
      return false;
    }
  }
  
  return false;
}

async function getUsername(userId, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/getChat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: userId })
    });
    const data = await response.json();
    return data.result?.username || null;
  } catch (error) {
    return null;
  }
}

async function getUserName(userId, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/getChat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: userId })
    });
    const data = await response.json();
    return data.result?.first_name || 'مستخدم';
  } catch (error) {
    return 'مستخدم';
  }
}

// ====================================================================
// ========== دوال القوائم ==========
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
      [{ text: '🔄 تصدير/استيراد', callback_data: 'admin_export' }],
      [{ text: '📊 الإحصائيات', callback_data: 'admin_stats' }]
    ]
  };

  return { text, keyboard };
}

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
      [{ text: '📋 طلبات التحقق', callback_data: 'verif_requests' }],
      [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
    ]
  };

  return { text, keyboard };
}

function getVerificationTypeMenu() {
  const types = [
    { text: '📱 رقم الهاتف', value: 'phone' },
    { text: '🧮 معادلة رياضية', value: 'math' },
    { text: '👤 موافقة المشرف', value: 'admin' }
  ];
  
  const buttons = types.map(t => {
    const isActive = verificationSystem.type === t.value;
    return [{ text: `${t.text} ${isActive ? '✅' : ''}`, callback_data: `verif_type_${t.value}` }];
  });
  
  const text = `
📝 **اختر نوع التحقق:**

📌 **الحالي:** ${verificationSystem.type}`;

  const keyboard = {
    inline_keyboard: [
      ...buttons,
      [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
    ]
  };

  return { text, keyboard };
}

function getVerificationMessagesMenu() {
  const type = verificationSystem.type;
  const messages = verificationSystem.messages[type] || verificationSystem.messages.phone;
  
  const text = `
✏️ **رسائل التحقق (${type === 'phone' ? '📱 رقم الهاتف' : type === 'math' ? '🧮 معادلة' : '👤 مشرف'})**

📌 **رسالة الطلب:**
${messages.request}

📌 **رسالة النجاح:**
${messages.success}

📌 **رسالة الفشل:**
${messages.fail}

${type === 'phone' ? '📌 **زر مشاركة الرقم:**\n' + messages.button : ''}

🔹 اختر الرسالة لتعديلها:`;

  const buttons = [
    [{ text: '📝 رسالة الطلب', callback_data: 'verif_msg_request' }],
    [{ text: '✅ رسالة النجاح', callback_data: 'verif_msg_success' }],
    [{ text: '❌ رسالة الفشل', callback_data: 'verif_msg_fail' }]
  ];
  
  if (type === 'phone') {
    buttons.push([{ text: '🔘 زر مشاركة الرقم', callback_data: 'verif_msg_button' }]);
  }
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'verif_back' }]);

  const keyboard = { inline_keyboard: buttons };
  return { text, keyboard };
}

function getVerifiedUsersMenu() {
  const users = Object.keys(verificationSystem.verifiedUsers);
  let text = `👥 **الأعضاء المتحققين**\n\n`;
  
  if (users.length === 0) {
    text += 'لا يوجد أعضاء متحققين.';
  } else {
    users.slice(0, 15).forEach(id => {
      const user = verificationSystem.verifiedUsers[id];
      text += `• ${user?.name || id} (${user?.method || 'غير معروف'})\n`;
    });
    if (users.length > 15) {
      text += `\n... و${users.length - 15} أعضاء آخرين`;
    }
    text += `\n\n📌 **الإجمالي:** ${users.length}`;
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

function getVerificationRequestsMenu() {
  const pending = Object.keys(verificationSystem.pendingVerifications);
  let text = `📋 **طلبات التحقق المعلقة**\n\n`;
  
  if (pending.length === 0) {
    text += 'لا توجد طلبات معلقة.';
  } else {
    pending.slice(0, 10).forEach(id => {
      const req = verificationSystem.pendingVerifications[id];
      text += `👤 ${req?.name || id}\n`;
      text += `🆔 @${req?.username || 'لا يوجد'}\n`;
      if (req?.phone) text += `📱 ${req.phone}\n`;
      text += `🕐 ${req?.time || ''}\n`;
      text += `─────────────────\n`;
    });
    if (pending.length > 10) {
      text += `\n... و${pending.length - 10} طلبات أخرى`;
    }
  }

  const buttons = [];
  pending.slice(0, 5).forEach(id => {
    buttons.push([
      { text: `✅ قبول ${id}`, callback_data: `verif_approve_${id}` },
      { text: `❌ رفض ${id}`, callback_data: `verif_reject_${id}` }
    ]);
  });
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'verif_back' }]);

  const keyboard = { inline_keyboard: buttons };
  return { text, keyboard };
}

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

function getRequestsMenu() {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  
  const text = `
📋 **إدارة الطلبات**

📌 **المعلقة:** ${pendingCount}
❌ **المرفوضة:** ${rejectedCount}
✅ **المعتمدين:** ${Object.keys(approvedUsers).length}

🔹 اختر القائمة:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `📋 الطلبات المعلقة (${pendingCount})`, callback_data: 'show_pending' }],
      [{ text: `❌ المرفوضين (${rejectedCount})`, callback_data: 'show_rejected' }],
      [{ text: `✅ المعتمدين (${Object.keys(approvedUsers).length})`, callback_data: 'show_approved' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

function getContentMenu() {
  const totalItems = Object.keys(contentSystem.items).length;

  const text = `
📦 **إدارة المحتوى**

📊 **الإحصائيات:**
• 📦 مجموع المحتويات: ${totalItems}

🔸 **الإجراءات:**`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📦 عرض الكل', callback_data: 'show_all_content' }],
      [{ text: '✏️ تعديل محتوى', callback_data: 'edit_content' }],
      [{ text: '🗑️ حذف محتوى', callback_data: 'delete_content' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

function getStatsMenu() {
  const stats = botSettings.stats;
  const text = `
📊 **الإحصائيات العامة**

👥 **المستخدمين:**
• ✅ معتمدين: ${Object.keys(approvedUsers).length}
• ⏳ معلق: ${Object.keys(pendingUsers).length}
• ❌ مرفوض: ${Object.keys(rejectedUsers).length}

📦 **المحتوى:**
• 📦 مجموع: ${Object.keys(contentSystem.items).length}
• 🖼️ صور: ${Object.values(contentSystem.items).filter(i => i.type === 'image').length}
• 🎬 فيديو: ${Object.values(contentSystem.items).filter(i => i.type === 'video').length}
• 📝 نصوص: ${Object.values(contentSystem.items).filter(i => i.type === 'text').length}

📈 **إحصائيات اليوم:**
• 👥 المستخدمين الجدد: ${stats.newUsersToday || 0}
• 💬 الرسائل: ${stats.totalMessages || 0}
• 📌 الجلسات: ${stats.sessions || 0}

📢 **قناة التسجيل:** ${botSettings.logChannel}
⏱️ **آخر تحديث:** ${new Date().toLocaleString('ar-EG')}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔄 تحديث الإحصائيات', callback_data: 'refresh_stats' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

function getExportImportMenu() {
  const text = `
🔄 **تصدير/استيراد البيانات**

📤 **تصدير:** حفظ جميع البيانات (مستخدمين، محتوى، إعدادات، نصوص)
📥 **استيراد:** استعادة البيانات من نسخة محفوظة

⚠️ **تحذير:** الاستيراد سيحل محل البيانات الحالية!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📤 تصدير البيانات', callback_data: 'export_data' }],
      [{ text: '📥 استيراد البيانات', callback_data: 'import_data' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
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
      body: JSON.stringify({ callback_query_id: callbackId, text: text || '✅ تم' })
    });
  } catch (error) {
    console.error('Error answering callback:', error);
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

  const contentId = text.trim();
  const item = contentSystem.items[contentId];
  
  if (item) {
    await sendContent(chatId, item, token);
  } else {
    await sendMessage(chatId, getUserText('no_content', { contentId }), token);
  }
}

async function sendContent(chatId, item, token) {
  const protection = contentProtection;
  let content = item.content;
  
  if (protection.enabled) {
    if (protection.excludeMedia && (item.type === 'image' || item.type === 'video')) {
      // استثناء الميديا
    } else if (protection.excludeLinks && content.includes('http')) {
      // استثناء الروابط
    } else if (protection.excludeText && item.type === 'text') {
      // استثناء النصوص
    } else {
      content = `🔒 **محتوى محمي**\n\n${content}`;
    }
  }

  if (item.fileId && (item.type === 'video' || item.type === 'animation')) {
    await sendVideo(chatId, item.fileId, content, token);
  } else if (item.fileId && item.type === 'image') {
    await sendPhoto(chatId, item.fileId, content, token);
  } else {
    await sendMessage(chatId, content, token);
  }
}

// ====================================================================
// ========== دوال إدارة المحتوى ==========
// ====================================================================

async function showAllContent(chatId, token) {
  const items = Object.values(contentSystem.items);
  
  if (items.length === 0) {
    await sendMessage(chatId, '📦 لا يوجد محتوى', token);
    return;
  }

  let message = '📦 **قائمة المحتويات:**\n\n';
  for (const item of items) {
    const typeIcon = item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : '📝';
    const count = item.mediaItems ? item.mediaItems.length : (item.type === 'text' ? 1 : 1);
    message += `${typeIcon} ${item.id} - ${item.title} (${count} عنصر)\n`;
    message += `📅 ${item.date}\n─────────────────\n`;
  }

  if (message.length > 4000) {
    const parts = message.match(/[\s\S]{1,4000}/g) || [];
    for (const part of parts) {
      await sendMessage(chatId, part, token);
    }
  } else {
    await sendMessage(chatId, message, token);
  }
}

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    botSettings.logChannel = env.LOG_CHANNEL_ID || 'ineswangelogs';
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

async function handleTelegramUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN_ID = env.ADMIN_ID;

  try {
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
        
        // معالجة الإدخالات النصية للأدمن
        if (adminState.currentAction === 'edit_stop_message' && adminState.step === 'waiting_input') {
          botSettings.stopMessage = text;
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          const menu = getBotSettingsMenu();
          await editMessage(adminState.tempData.chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم تحديث رسالة الإيقاف', token);
          return;
        }

        if (adminState.currentAction === 'edit_verif_message' && adminState.step === 'waiting_input') {
          const { key, chatId: targetChatId, messageId: targetMessageId } = adminState.tempData;
          const type = verificationSystem.type;
          if (!verificationSystem.messages[type]) {
            verificationSystem.messages[type] = {};
          }
          verificationSystem.messages[type][key] = text;
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          adminState.tempData = {};
          
          const menu = getVerificationMessagesMenu();
          await editMessage(targetChatId, targetMessageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم تحديث الرسالة', token);
          return;
        }

        if (adminState.currentAction === 'verif_user_add' && adminState.step === 'waiting_input') {
          const userId = text.trim();
          verificationSystem.verifiedUsers[userId] = { 
            name: await getUserName(userId, token) || userId, 
            method: 'manual',
            verifiedAt: new Date().toISOString() 
          };
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          const menu = getVerifiedUsersMenu();
          await editMessage(adminState.tempData.chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, `✅ تم إضافة المستخدم ${userId}`, token);
          return;
        }

        if (adminState.currentAction === 'verif_user_remove' && adminState.step === 'waiting_input') {
          const userId = text.trim();
          if (verificationSystem.verifiedUsers[userId]) {
            delete verificationSystem.verifiedUsers[userId];
            await saveAllData(env);
            const menu = getVerifiedUsersMenu();
            await editMessage(adminState.tempData.chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
            await sendMessage(chatId, `✅ تم حذف المستخدم ${userId}`, token);
          } else {
            await sendMessage(chatId, `❌ المستخدم ${userId} غير موجود`, token);
          }
          adminState.currentAction = null;
          adminState.step = null;
          return;
        }

        // معالجة استيراد البيانات
        if (adminState.currentAction === 'import_data' && adminState.step === 'waiting_data') {
          await importAllData(chatId, text, token, env);
          adminState.currentAction = null;
          adminState.step = null;
          return;
        }

        return;
      }

      // ========== واجهة المستخدم ==========
      if (!botSettings.isActive) {
        await sendMessage(chatId, botSettings.stopMessage, token);
        return;
      }

      if (rejectedUsers[userId]) {
        await sendMessage(chatId, '❌ طلبك مرفوض.', token);
        return;
      }

      if (text === '/start') {
        if (approvedUsers[userId]) {
          const verified = await handleVerification(userId, chatId, token, env);
          if (!verified) return;
          
          botSettings.stats.sessions = (botSettings.stats.sessions || 0) + 1;
          await saveAllData(env);
          await showUserMainMenu(chatId, token);
          return;
        }

        if (pendingUsers[userId]) {
          await sendMessage(chatId, '⏳ طلبك قيد المراجعة...', token);
          return;
        }

        await sendMessage(chatId, '🔐 شارك رقم هاتفك للتحقق:', token, {
          reply_markup: {
            keyboard: [[{ text: '📱 مشاركة الرقم', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }

      // معالجة التحقق بالمعادلة
      if (verificationSystem.enabled && verificationSystem.type === 'math') {
        if (verificationSystem.mathQuestions[userId]) {
          const verified = await handleVerificationResponse(userId, chatId, text, token, env);
          if (verified) {
            await showUserMainMenu(chatId, token);
          }
          return;
        }
      }

      // معالجة رقم الهاتف
      if (msg.contact) {
        const contact = msg.contact;
        
        // إذا كان التحقق عبر الهاتف مفعلاً
        if (verificationSystem.enabled && verificationSystem.type === 'phone') {
          if (contact.user_id !== userId) {
            await sendMessage(chatId, '❌ يرجى مشاركة رقمك الخاص!', token);
            return;
          }
          
          verificationSystem.verifiedUsers[userId] = {
            name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
            phone: contact.phone_number,
            method: 'phone',
            verifiedAt: new Date().toISOString()
          };
          await saveAllData(env);
          
          const msgText = verificationSystem.messages.phone;
          await sendMessage(chatId, msgText.success, token);
          
          const adminMsg = `
📱 **تحقق جديد عبر الهاتف!**

👤 **الاسم:** ${msg.from.first_name} ${msg.from.last_name || ''}
🆔 **اليوزرنيم:** @${msg.from.username || 'لا يوجد'}
📱 **رقم الهاتف:** ${contact.phone_number}
🕐 **الوقت:** ${new Date().toLocaleString('ar-EG')}`;

          await sendMessage(ADMIN_ID, adminMsg, token);
          await showUserMainMenu(chatId, token);
          return;
        }

        // التحقق العادي (للموافقة)
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
        
        const adminMsg = `
📢 **طلب انضمام جديد!**

👤 **الاسم:** ${userData.name}
🆔 **اليوزرنيم:** @${userData.username}
📱 **رقم الهاتف:** ${userData.phone}
🕐 **الوقت:** ${userData.time}`;

        const adminKeyboard = {
          inline_keyboard: [
            [
              { text: '✅ قبول', callback_data: `approve_${userId}` },
              { text: '❌ رفض', callback_data: `reject_${userId}` }
            ]
          ]
        };

        await sendMessage(ADMIN_ID, adminMsg, token, { reply_markup: adminKeyboard });
        return;
      }

      if (!approvedUsers[userId]) {
        await sendMessage(chatId, '🔐 يرجى مشاركة رقم هاتفك أولاً.\nاضغط /start', token);
        return;
      }

      // معالجة البحث
      if (approvedUsers[userId]) {
        botSettings.stats.totalMessages = (botSettings.stats.totalMessages || 0) + 1;
        await saveAllData(env);
        await handleUserSearch(chatId, text, token, userId);
        return;
      }
    }
  } catch (error) {
    console.error('Error in handleTelegramUpdate:', error);
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

  if (data === 'admin_requests') {
    const menu = getRequestsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'admin_content') {
    const menu = getContentMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'admin_stats') {
    const menu = getStatsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data === 'admin_export') {
    const menu = getExportImportMenu();
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
    return;
  }

  if (data === 'bot_stop_message') {
    adminState.currentAction = 'edit_stop_message';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, `📝 **أدخل رسالة الإيقاف الجديدة:**\n\nالحالية:\n${botSettings.stopMessage}`, token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء' }]],
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
    await sendMessage(chatId, `✅ **تم تغيير الرابط:**\n${newLink}`, token);
    return;
  }

  if (data === 'bot_clear_users') {
    approvedUsers = {};
    rejectedUsers = {};
    pendingUsers = {};
    await saveAllData(env);
    const menu = getBotSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '🗑️ **تم مسح جميع المستخدمين**', token);
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

  if (data.startsWith('verif_type_')) {
    const type = data.replace('verif_type_', '');
    verificationSystem.type = type;
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

  if (data === 'verif_msg_request' || data === 'verif_msg_success' || 
      data === 'verif_msg_fail' || data === 'verif_msg_button') {
    const key = data === 'verif_msg_request' ? 'request' : 
                data === 'verif_msg_success' ? 'success' : 
                data === 'verif_msg_fail' ? 'fail' : 'button';
    adminState.currentAction = 'edit_verif_message';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId, key };
    
    const type = verificationSystem.type;
    const currentVal = verificationSystem.messages[type]?.[key] || '';
    await sendMessage(chatId, `📝 **أدخل النص الجديد لـ "${key}":**\n\nالحالي:\n${currentVal}`, token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء' }]],
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

  if (data === 'verif_user_add') {
    adminState.currentAction = 'verif_user_add';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, '📝 **أرسل ID المستخدم للإضافة:**', token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  if (data === 'verif_user_remove') {
    adminState.currentAction = 'verif_user_remove';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, '📝 **أرسل ID المستخدم للحذف:**', token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  if (data === 'verif_requests') {
    const menu = getVerificationRequestsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== معالجة طلبات التحقق =====
  if (data.startsWith('verif_approve_')) {
    const userId = data.replace('verif_approve_', '');
    if (verificationSystem.pendingVerifications[userId]) {
      const userData = verificationSystem.pendingVerifications[userId];
      verificationSystem.verifiedUsers[userId] = {
        name: userData.name,
        method: 'admin',
        verifiedAt: new Date().toISOString()
      };
      delete verificationSystem.pendingVerifications[userId];
      await saveAllData(env);
      
      const msg = verificationSystem.messages.admin;
      await sendMessage(userId, msg.success, token);
      
      const menu = getVerificationRequestsMenu();
      await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, `✅ تم قبول المستخدم ${userData.name}`, token);
    }
    return;
  }

  if (data.startsWith('verif_reject_')) {
    const userId = data.replace('verif_reject_', '');
    if (verificationSystem.pendingVerifications[userId]) {
      const userData = verificationSystem.pendingVerifications[userId];
      delete verificationSystem.pendingVerifications[userId];
      await saveAllData(env);
      
      const msg = verificationSystem.messages.admin;
      await sendMessage(userId, msg.fail, token);
      
      const menu = getVerificationRequestsMenu();
      await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, `❌ تم رفض المستخدم ${userData.name}`, token);
    }
    return;
  }

  if (data.startsWith('verif_admin_approve_')) {
    const userId = data.replace('verif_admin_approve_', '');
    if (verificationSystem.pendingVerifications[userId]) {
      const userData = verificationSystem.pendingVerifications[userId];
      verificationSystem.verifiedUsers[userId] = {
        name: userData.name,
        method: 'admin',
        verifiedAt: new Date().toISOString()
      };
      delete verificationSystem.pendingVerifications[userId];
      await saveAllData(env);
      
      const msg = verificationSystem.messages.admin;
      await sendMessage(userId, msg.success, token);
      await editMessage(chatId, messageId, '✅ **تم قبول طلب التحقق**', token);
    }
    return;
  }

  if (data.startsWith('verif_admin_reject_')) {
    const userId = data.replace('verif_admin_reject_', '');
    if (verificationSystem.pendingVerifications[userId]) {
      const userData = verificationSystem.pendingVerifications[userId];
      delete verificationSystem.pendingVerifications[userId];
      await saveAllData(env);
      
      const msg = verificationSystem.messages.admin;
      await sendMessage(userId, msg.fail, token);
      await editMessage(chatId, messageId, '❌ **تم رفض طلب التحقق**', token);
    }
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

  // ===== تصدير/استيراد =====
  if (data === 'export_data') {
    await exportAllData(chatId, token);
    return;
  }

  if (data === 'import_data') {
    adminState.currentAction = 'import_data';
    adminState.step = 'waiting_data';
    await sendMessage(chatId, '📥 **أرسل بيانات JSON للاستيراد:**', token, {
      reply_markup: {
        keyboard: [[{ text: '🔙 إلغاء' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // ===== إدارة الطلبات =====
  if (data === 'show_pending') {
    await showPendingRequests(chatId, token);
    return;
  }

  if (data === 'show_rejected') {
    await showRejectedRequests(chatId, token);
    return;
  }

  if (data === 'show_approved') {
    await showApprovedUsers(chatId, token);
    return;
  }

  // ===== إدارة المحتوى =====
  if (data === 'show_all_content') {
    await showAllContent(chatId, token);
    return;
  }

  if (data === 'edit_content') {
    await showEditContentMenu(chatId, token);
    return;
  }

  if (data === 'delete_content') {
    await showDeleteContentMenu(chatId, token);
    return;
  }

  // ===== قبول/رفض الطلبات =====
  if (data.startsWith('approve_')) {
    const targetId = data.split('_')[1];
    if (pendingUsers[targetId]) {
      approvedUsers[targetId] = pendingUsers[targetId];
      delete pendingUsers[targetId];
      delete rejectedUsers[targetId];
      await saveAllData(env);
      
      await sendMessage(targetId, '✅ **تمت الموافقة! اضغط /start**', token);
      await sendMessage(chatId, '✅ **تم القبول**', token);
      await showPendingRequests(chatId, token);
    }
    return;
  }

  if (data.startsWith('reject_')) {
    const targetId = data.split('_')[1];
    if (pendingUsers[targetId]) {
      rejectedUsers[targetId] = pendingUsers[targetId];
      delete pendingUsers[targetId];
      delete approvedUsers[targetId];
      await saveAllData(env);
      
      await sendMessage(targetId, '❌ **طلبك مرفوض.**', token);
      await sendMessage(chatId, '❌ **تم الرفض**', token);
      await showPendingRequests(chatId, token);
    }
    return;
  }

  if (data.startsWith('reapprove_')) {
    const targetId = data.split('_')[1];
    if (rejectedUsers[targetId]) {
      approvedUsers[targetId] = rejectedUsers[targetId];
      delete rejectedUsers[targetId];
      delete pendingUsers[targetId];
      await saveAllData(env);
      
      await sendMessage(targetId, '✅ **تم استئناف طلبك! اضغط /start**', token);
      await sendMessage(chatId, '✅ **تم إعادة الموافقة**', token);
      await showRejectedRequests(chatId, token);
    }
    return;
  }

  if (data.startsWith('details_')) {
    const targetId = data.split('_')[1];
    let userInfo = pendingUsers[targetId] || rejectedUsers[targetId] || approvedUsers[targetId];
    if (userInfo) {
      const details = `
📋 **تفاصيل المستخدم**

👤 **الاسم:** ${userInfo.name}
🆔 **اليوزرنيم:** @${userInfo.username}
📱 **رقم الهاتف:** ${userInfo.phone || 'غير متاح'}
🕐 **تاريخ الطلب:** ${userInfo.time || 'غير معروف'}`;
      await sendMessage(chatId, details, token);
    }
    return;
  }

  if (data.startsWith('delete_user_')) {
    const targetId = data.split('_')[2];
    if (rejectedUsers[targetId]) {
      delete rejectedUsers[targetId];
      await saveAllData(env);
      await sendMessage(chatId, '🗑️ **تم حذف المستخدم**', token);
      await showRejectedRequests(chatId, token);
    }
    return;
  }

  // ===== إلغاء =====
  if (data === 'cancel') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    const menu = getAdminMainMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== تحديث الإحصائيات =====
  if (data === 'refresh_stats') {
    const menu = getStatsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
}

// ====================================================================
// ========== دوال عرض القوائم ==========
// ====================================================================

async function showPendingRequests(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  if (pendingList.length === 0) {
    await sendMessage(chatId, '📋 لا توجد طلبات معلقة', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = '📋 **الطلبات المعلقة:**\n\n';
  const buttons = [];
  
  for (const user of pendingList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n─────────────────\n`;
    buttons.push([
      { text: `✅ قبول`, callback_data: `approve_${user.id}` },
      { text: `❌ رفض`, callback_data: `reject_${user.id}` }
    ]);
    buttons.push([
      { text: `📋 تفاصيل`, callback_data: `details_${user.id}` }
    ]);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showRejectedRequests(chatId, token) {
  const rejectedList = Object.values(rejectedUsers);
  if (rejectedList.length === 0) {
    await sendMessage(chatId, '❌ لا يوجد مرفوضين', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = '❌ **المرفوضين:**\n\n';
  const buttons = [];
  
  for (const user of rejectedList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n─────────────────\n`;
    buttons.push([
      { text: `✅ إعادة موافقة`, callback_data: `reapprove_${user.id}` },
      { text: `🗑️ حذف`, callback_data: `delete_user_${user.id}` }
    ]);
    buttons.push([
      { text: `📋 تفاصيل`, callback_data: `details_${user.id}` }
    ]);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showApprovedUsers(chatId, token) {
  const approvedList = Object.values(approvedUsers);
  if (approvedList.length === 0) {
    await sendMessage(chatId, '✅ لا يوجد معتمدين', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = '✅ **المعتمدين:**\n\n';
  const buttons = [];
  
  for (const user of approvedList.slice(0, 10)) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n─────────────────\n`;
    buttons.push([
      { text: `📋 تفاصيل`, callback_data: `details_${user.id}` }
    ]);
  }
  
  if (approvedList.length > 10) {
    message += `\n⚠️ يوجد ${approvedList.length - 10} معتمدين آخرين...`;
  }
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showEditContentMenu(chatId, token) {
  const items = Object.values(contentSystem.items);
  if (items.length === 0) {
    await sendMessage(chatId, '📦 لا يوجد محتوى للتعديل', token);
    return;
  }

  const buttons = items.map(item => [
    { text: `✏️ ${item.id} - ${item.title}`, callback_data: `edit_content_item_${item.id}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '✏️ **اختر المحتوى للتعديل:**', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showDeleteContentMenu(chatId, token) {
  const items = Object.values(contentSystem.items);
  if (items.length === 0) {
    await sendMessage(chatId, '📦 لا يوجد محتوى للحذف', token);
    return;
  }

  const buttons = items.map(item => [
    { text: `🗑️ ${item.id} - ${item.title}`, callback_data: `delete_content_item_${item.id}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '🗑️ **اختر المحتوى للحذف:**', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== توليد ID ==========
// ====================================================================

function generateContentId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

console.log('✅ Bot is ready!');
