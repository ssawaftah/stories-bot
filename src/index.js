// ====================================================================
// ========== بوت تيليجرام المتكامل ==========
// ====================================================================

// ========== البيانات الافتراضية ==========
const DEFAULT_DATA = {
  settings: {
    botActive: true,
    stopMessage: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.'
  },
  verification: {
    enabled: false,
    channelId: null,
    channelName: null,
    requestMessage: '🔐 يرجى مشاركة رقم هاتفك للتحقق:',
    buttonText: '📱 مشاركة الرقم',
    successMessage: '✅ تم التحقق بنجاح!',
    failMessage: '❌ تم رفض طلب التحقق.',
    verifiedUsers: {},
    rejectedUsers: {},
    pendingUsers: {}
  },
  protection: {
    enabled: false
  },
  notifications: {
    enabled: false,
    channelId: null,
    channelName: null
  },
  welcome: {
    text: '🎉 <b>مرحباً بك في البوت!</b>\n\nيمكنك استخدام البوت للوصول إلى المحتوى.',
    image: null,
    useHtml: true,
    registeredMessage: '📦 <b>مرحباً بعودتك!</b>\n\nيمكنك استخدام البوت الآن.'
  },
  commands: {},
  users: {},
  content: {},
  forcedSubscription: {
    enabled: false,
    list: [],
    settings: {
      notification: false,
      displayMode: 'grouped',
      verifyButtonText: 'تحقق ✅',
      groupedMessage: '📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>',
      checkInterval: 3,
    },
    userStatus: {}
  }
};

let data = {};
const adminState = { action: null, step: null, temp: {} };

// ====================================================================
// ========== دوال KV ==========
// ====================================================================

async function loadData(env) {
  try {
    const stored = await env.KV_NAMESPACE.get('bot_data', 'json');
    if (stored) {
      data = stored;
      console.log('✅ Data loaded from KV');
    } else {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      await saveData(env);
      console.log('✅ Default data saved to KV');
    }
  } catch (e) {
    console.error('Error loading data:', e);
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

async function saveData(env) {
  try {
    await env.KV_NAMESPACE.put('bot_data', JSON.stringify(data));
    console.log('✅ Data saved to KV');
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

// ====================================================================
// ========== دوال مساعدة ==========
// ====================================================================

async function sendMessage(chatId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true },
    ...(data.protection.enabled ? { protect_content: true } : {})
  };
  if (extra) {
    if (extra.reply_markup) payload.reply_markup = extra.reply_markup;
    if (extra.bypass_protection) delete payload.protect_content;
    Object.assign(payload, extra);
  }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (e) {
    console.error('Send error:', e);
    return { ok: false, description: e.message };
  }
}

async function sendPhoto(chatId, fileId, caption, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/sendPhoto';
  const payload = {
    chat_id: chatId,
    photo: fileId,
    caption: caption || '',
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true },
    ...(data.protection.enabled ? { protect_content: true } : {})
  };
  if (extra) {
    if (extra.reply_markup) payload.reply_markup = extra.reply_markup;
    if (extra.bypass_protection) delete payload.protect_content;
    Object.assign(payload, extra);
  }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (e) {
    console.error('Send photo error:', e);
    return { ok: false, description: e.message };
  }
}

async function editMessage(chatId, msgId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/editMessageText';
  const payload = { chat_id: chatId, message_id: msgId, text: text, parse_mode: 'HTML' };
  if (extra) Object.assign(payload, extra);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await res.json();
  } catch (e) {
    console.error('Edit error:', e);
    return { ok: false };
  }
}

async function answerCallback(cbId, text, token) {
  const url = 'https://api.telegram.org/bot' + token + '/answerCallbackQuery';
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cbId, text: text || '✅' }) });
  } catch (e) {
    console.error('Callback error:', e);
  }
}

async function getChatInfo(chatId, token) {
  const url = 'https://api.telegram.org/bot' + token + '/getChat';
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId }) });
    const result = await res.json();
    if (result.ok && result.result) {
      return { name: result.result.title || result.result.username || chatId, type: result.result.type };
    }
    return null;
  } catch (e) {
    console.error('Error getting chat info:', e);
    return null;
  }
}

async function getChatMember(chatId, userId, token) {
  const url = 'https://api.telegram.org/bot' + token + '/getChatMember';
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, user_id: userId }) });
    const result = await res.json();
    return result.ok ? result.result : null;
  } catch (e) {
    console.error('Error getting chat member:', e);
    return null;
  }
}

async function updateBotCommands(token) {
  const url = 'https://api.telegram.org/bot' + token + '/setMyCommands';
  const commands = [{ command: 'start', description: 'بدء استخدام البوت' }];
  const keys = Object.keys(data.commands || {});
  keys.forEach(k => {
    if (data.commands[k].enabled) {
      commands.push({ command: k, description: data.commands[k].description || 'أمر مخصص' });
    }
  });
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: commands }) });
  } catch (e) {
    console.error('Error updating commands:', e);
  }
}

// ====================================================================
// ========== دوال التسجيل (Logs) ==========
// ====================================================================

let logChannelId = null;
let logEnabled = false;

function setLogChannel(channelId) { logChannelId = channelId; }
function setLogEnabled(enabled) { logEnabled = enabled; }

async function sendLog(userId, username, name, action, details, token) {
  if (!logEnabled || !logChannelId) return;
  const now = new Date();
  const date = now.toLocaleDateString('ar-EG');
  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const message = `
📋 <b>سجل الإجراءات</b>

👤 <b>الاسم:</b> ${name || 'غير معروف'}
🆔 <b>اليوزرنيم:</b> @${username || 'لا يوجد'}
🆔 <b>المعرف:</b> ${userId}

⚡ <b>الإجراء:</b> ${action}
📝 <b>التفاصيل:</b> ${details}

📅 <b>التاريخ:</b> ${date}
🕐 <b>الوقت:</b> ${time} (توقيت الأردن)
─────────────────`;
  try {
    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: logChannelId, text: message, parse_mode: 'HTML' }) });
  } catch (e) {
    console.error('Log error:', e);
  }
}

// ====================================================================
// ========== دوال الاشتراك الإجباري ==========
// ====================================================================

async function checkForcedSubscription(userId, token) {
  const fs = data.forcedSubscription;
  if (!fs.enabled || !fs.list || fs.list.length === 0) return true;
  if (fs.userStatus && fs.userStatus[userId] && fs.userStatus[userId].completed) return true;
  const activeSubs = fs.list.filter(s => s.enabled !== false);
  if (activeSubs.length === 0) return true;
  let allSubscribed = true;
  for (const sub of activeSubs) {
    const subscribed = await checkSingleSubscription(userId, sub, token);
    if (!subscribed) { allSubscribed = false; break; }
  }
  if (allSubscribed) {
    if (!fs.userStatus) fs.userStatus = {};
    fs.userStatus[userId] = { completed: true, timestamp: Date.now() };
    if (fs.settings.notification) {
      const user = data.users[userId] || {};
      await sendLog(userId, user.username, user.name, '✅ اشتراك إجباري', 'أكمل المستخدم جميع الاشتراكات', token);
    }
    return true;
  }
  return false;
}

async function checkSingleSubscription(userId, sub, token) {
  try {
    if (sub.type === 'channel' || sub.type === 'group') {
      const member = await getChatMember(sub.id, userId, token);
      if (member && (member.status === 'member' || member.status === 'administrator' || member.status === 'creator')) return true;
      return false;
    } else if (sub.type === 'bot') {
      try {
        const member = await getChatMember(sub.id, userId, token);
        if (member && (member.status === 'member' || member.status === 'restricted')) return true;
        return false;
      } catch (e) { return false; }
    } else if (sub.type === 'link') {
      if (data.forcedSubscription.userStatus && data.forcedSubscription.userStatus[userId] &&
          data.forcedSubscription.userStatus[userId].links && data.forcedSubscription.userStatus[userId].links[sub.id]) {
        const linkStatus = data.forcedSubscription.userStatus[userId].links[sub.id];
        if (linkStatus.completed && (Date.now() - linkStatus.timestamp < 3600000)) return true;
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error checking subscription:', e);
    return false;
  }
}

function getForcedSubscriptionKeyboard(userId) {
  const fs = data.forcedSubscription;
  const activeSubs = fs.list.filter(s => s.enabled !== false);
  if (activeSubs.length === 0) return null;
  if (fs.settings.displayMode === 'separate') return null;
  const buttons = [];
  for (const sub of activeSubs) {
    let label = sub.name || sub.type;
    if (sub.type === 'channel') label = '📢 ' + label;
    else if (sub.type === 'group') label = '👥 ' + label;
    else if (sub.type === 'bot') label = '🤖 ' + label;
    else if (sub.type === 'link') label = '🔗 ' + label;
    buttons.push([{ text: label, url: sub.link || 'https://t.me/' }]);
  }
  buttons.push([{ text: fs.settings.verifyButtonText || 'تحقق ✅', callback_data: 'check_subscription' }]);
  return { inline_keyboard: buttons };
}

async function showForcedSubscription(chatId, userId, token) {
  const fs = data.forcedSubscription;
  const activeSubs = fs.list.filter(s => s.enabled !== false);
  if (activeSubs.length === 0) return;
  if (fs.settings.displayMode === 'separate') {
    for (const sub of activeSubs) {
      const subscribed = await checkSingleSubscription(userId, sub, token);
      if (!subscribed) {
        let text = '🔗 <b>' + (sub.name || 'اشتراك مطلوب') + '</b>\n\n';
        if (sub.message) text += sub.message + '\n\n';
        if (sub.type === 'link') {
          text += '🔗 <a href="' + sub.link + '">اضغط هنا للدخول</a>\n';
          text += '⏳ بعد الدخول انتظر 3 ثوانٍ ثم اضغط "تم".';
          const kb = {
            inline_keyboard: [
              [{ text: '✅ تم', callback_data: 'fs_link_done_' + sub.id }],
              [{ text: '🔄 التحقق', callback_data: 'check_subscription' }]
            ]
          };
          await sendMessage(chatId, text, token, { reply_markup: kb });
        } else {
          if (sub.link) text += '🔗 <a href="' + sub.link + '">الاشتراك</a>\n';
          text += '\n📌 بعد الاشتراك، اضغط "تحقق ✅"';
          const kb = {
            inline_keyboard: [
              [{ text: '✅ تحقق', callback_data: 'check_subscription' }]
            ]
          };
          await sendMessage(chatId, text, token, { reply_markup: kb });
        }
        return;
      }
    }
    await sendMessage(chatId, '✅ <b>تم التحقق من جميع الاشتراكات!</b>', token);
  } else {
    const text = fs.settings.groupedMessage || '📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>';
    const keyboard = getForcedSubscriptionKeyboard(userId);
    if (keyboard) {
      await sendMessage(chatId, text, token, { reply_markup: keyboard });
    } else {
      await sendMessage(chatId, text, token);
    }
  }
}

// ====================================================================
// ========== دوال إنشاء القوائم ==========
// ====================================================================

function adminMenu() {
  return {
    text: '🔹 <b>لوحة التحكم</b>\n\nاختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '⚙️ الإعدادات', callback_data: 'admin_settings' }],
        [{ text: '✏️ رسالة الترحيب', callback_data: 'admin_welcome' }],
        [{ text: '📋 إدارة الأوامر', callback_data: 'admin_commands' }],
        [{ text: '👥 المستخدمين', callback_data: 'admin_users' }],
        [{ text: '🔗 الاشتراك الإجباري', callback_data: 'admin_forced_subscription' }]
      ]
    }
  };
}

function settingsMenu() {
  const botStatus = data.settings.botActive ? '🟩 البوت يعمل' : '🟥 البوت متوقف';
  const verStatus = data.verification.enabled ? '🟩 التحقق من العضوية نشط' : '🟥 التحقق من العضوية متوقف';
  const verChannel = data.verification.channelName || data.verification.channelId || 'غير محدد';
  const protectStatus = data.protection.enabled ? '🔒 الحماية مفعلة' : '🔓 الحماية معطلة';
  const notifStatus = data.notifications.enabled ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة';
  const notifChannel = data.notifications.channelName || data.notifications.channelId || 'غير محدد';
  const fsStatus = data.forcedSubscription.enabled ? '🟩 مفعل' : '🟥 معطل';
  return {
    text: '⚙️ <b>الإعدادات</b>\n\n' +
          '🤖 <b>حالة البوت:</b> ' + botStatus + '\n' +
          '✅ <b>التحقق:</b> ' + verStatus + '\n' +
          '📢 <b>قناة التحقق:</b> ' + verChannel + '\n' +
          '🔒 <b>حماية المحتوى:</b> ' + protectStatus + '\n' +
          '🔔 <b>الإشعارات:</b> ' + notifStatus + '\n' +
          '📢 <b>قناة الإشعارات:</b> ' + notifChannel + '\n' +
          '🔗 <b>الاشتراك الإجباري:</b> ' + fsStatus + '\n\n' +
          '🔹 اختر القسم:',
    keyboard: {
      inline_keyboard: [
        [{ text: '🤖 حالة البوت', callback_data: 'settings_bot_toggle' }],
        [{ text: '✅ التحقق من العضوية', callback_data: 'settings_verification' }],
        [{ text: '🔒 حماية المحتوى', callback_data: 'settings_protection' }],
        [{ text: '🔔 الإشعارات', callback_data: 'settings_notifications' }],
        [{ text: '🔗 الاشتراك الإجباري', callback_data: 'settings_forced_subscription' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function botSettingsMenu() {
  const status = data.settings.botActive ? '🟩 البوت يعمل' : '🟥 البوت متوقف';
  return {
    text: '🤖 <b>حالة البوت</b>\n\n📌 الحالية: ' + status + '\n\n<b>رسالة الإيقاف الحالية:</b>\n' + data.settings.stopMessage,
    keyboard: {
      inline_keyboard: [
        [{ text: status + ' - اضغط للتغيير', callback_data: 'bot_toggle' }],
        [{ text: '✏️ تعديل رسالة الإيقاف', callback_data: 'bot_edit_stop' }],
        [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
      ]
    }
  };
}

function verificationMenu() {
  const v = data.verification;
  const status = v.enabled ? '🟩 نشط' : '🟥 متوقف';
  const channel = v.channelName || v.channelId || 'غير محدد';
  return {
    text: '✅ <b>التحقق من العضوية</b>\n\n📌 الحالة: ' + status + '\n📢 قناة التحقق: ' + channel + '\n\n🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 ' + (v.enabled ? 'تعطيل' : 'تفعيل') + ' التحقق', callback_data: 'verif_toggle' }],
        [{ text: '✏️ رسائل التحقق', callback_data: 'verif_messages' }],
        [{ text: '📢 تعيين قناة التحقق', callback_data: 'verif_channel' }],
        [{ text: '📋 قائمة التحقق', callback_data: 'verif_list' }],
        [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
      ]
    }
  };
}

function verificationMessagesMenu() {
  const v = data.verification;
  return {
    text: '✏️ <b>رسائل التحقق</b>\n\n📝 <b>طلب الرقم:</b>\n' + v.requestMessage + '\n\n🔘 <b>زر المشاركة:</b>\n' + v.buttonText + '\n\n✅ <b>رسالة النجاح:</b>\n' + v.successMessage + '\n\n❌ <b>رسالة الرفض:</b>\n' + v.failMessage,
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ نص طلب الرقم', callback_data: 'verif_msg_request' }],
        [{ text: '✏️ نص زر المشاركة', callback_data: 'verif_msg_button' }],
        [{ text: '✏️ رسالة النجاح', callback_data: 'verif_msg_success' }],
        [{ text: '✏️ رسالة الرفض', callback_data: 'verif_msg_fail' }],
        [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
      ]
    }
  };
}

function verificationListMenu() {
  const v = data.verification;
  const verified = Object.keys(v.verifiedUsers || {});
  const rejected = Object.keys(v.rejectedUsers || {});
  return {
    text: '📋 <b>قائمة التحقق</b>\n\n✅ المحققين: ' + verified.length + '\n❌ المرفوضين: ' + rejected.length,
    keyboard: {
      inline_keyboard: [
        [{ text: '✅ المحققين', callback_data: 'verif_list_verified' }],
        [{ text: '❌ المرفوضين', callback_data: 'verif_list_rejected' }],
        [{ text: '➕ إضافة مستخدم', callback_data: 'verif_add_user' }],
        [{ text: '🗑️ حذف مستخدم', callback_data: 'verif_remove_user' }],
        [{ text: '🔙 رجوع', callback_data: 'verif_back' }]
      ]
    }
  };
}

function protectionMenu() {
  const status = data.protection.enabled ? '🔒 الحماية مفعلة' : '🔓 الحماية معطلة';
  return {
    text: '🔒 <b>حماية المحتوى</b>\n\n📌 الحالية: ' + status + '\n\nعند التفعيل، سيمنع المستخدمون من نسخ النصوص، حفظ الصور والفيديوهات، وتوجيه الرسائل.',
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 ' + (data.protection.enabled ? 'تعطيل' : 'تفعيل') + ' الحماية', callback_data: 'protect_toggle' }],
        [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
      ]
    }
  };
}

function notificationsMenu() {
  const status = data.notifications.enabled ? '🔔 مفعل' : '🔕 معطل';
  const channel = data.notifications.channelName || data.notifications.channelId || 'غير محدد';
  return {
    text: '🔔 <b>الإشعارات والأحداثيات</b>\n\n📌 الحالة: ' + status + '\n📢 القناة: ' + channel + '\n\nعند التفعيل، ستصل جميع إجراءات المستخدمين إلى القناة المحددة.',
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 ' + (data.notifications.enabled ? 'تعطيل' : 'تفعيل') + ' الإشعارات', callback_data: 'notif_toggle' }],
        [{ text: '📢 تعيين قناة', callback_data: 'notif_channel' }],
        [{ text: '🔙 رجوع', callback_data: 'settings_back' }]
      ]
    }
  };
}

function welcomeMenu() {
  const w = data.welcome;
  const hasImage = w.image ? '🟢 موجودة' : '🔴 غير موجودة';
  const htmlStatus = w.useHtml ? '🟢 مفعل' : '🔴 معطل';
  return {
    text: '✏️ <b>رسالة الترحيب</b>\n\n' +
          '📝 <b>النص:</b>\n' + w.text + '\n\n' +
          '🖼️ <b>الصورة:</b> ' + hasImage + '\n' +
          '📄 <b>وضع HTML:</b> ' + htmlStatus + '\n\n' +
          '📦 <b>رسالة المستخدم المسجل:</b>\n' + w.registeredMessage + '\n\n' +
          '🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ تعديل النص', callback_data: 'welcome_edit_text' }],
        [{ text: '🖼️ إضافة/تغيير صورة', callback_data: 'welcome_edit_image' }],
        [{ text: '🗑️ حذف الصورة', callback_data: 'welcome_delete_image' }],
        [{ text: '📄 ' + (w.useHtml ? 'تعطيل' : 'تفعيل') + ' HTML', callback_data: 'welcome_toggle_html' }],
        [{ text: '✏️ رسالة المستخدم المسجل', callback_data: 'welcome_edit_registered' }],
        [{ text: '📋 معاينة', callback_data: 'welcome_preview' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function commandsMenu() {
  let text = '📋 <b>إدارة الأوامر</b>\n\n';
  const keys = Object.keys(data.commands || {});
  if (keys.length === 0) {
    text += 'لا توجد أوامر مخصصة.\n';
  } else {
    keys.forEach(k => {
      text += '• /' + k + ' - ' + data.commands[k].description + ' ' + (data.commands[k].enabled ? '✅' : '❌') + '\n';
    });
  }
  text += '\n🔹 اختر الإجراء:';
  return {
    text: text,
    keyboard: {
      inline_keyboard: [
        [{ text: '➕ إضافة أمر', callback_data: 'cmd_add' }],
        [{ text: '✏️ تعديل أمر', callback_data: 'cmd_edit' }],
        [{ text: '🗑️ حذف أمر', callback_data: 'cmd_delete' }],
        [{ text: '🔄 تفعيل/تعطيل', callback_data: 'cmd_toggle' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function usersMenu() {
  const users = Object.keys(data.users || {});
  return {
    text: '👥 <b>إدارة المستخدمين</b>\n\n📌 إجمالي المستخدمين: ' + users.length + '\n\n🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '📋 عرض جميع المستخدمين', callback_data: 'users_list' }],
        [{ text: '🗑️ حذف مستخدم', callback_data: 'users_delete' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function usersListMenu(page) {
  const users = Object.keys(data.users || {});
  const total = users.length;
  const perPage = 10;
  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, total);
  const pageUsers = users.slice(start, end);
  let text = '👥 <b>قائمة المستخدمين</b>\n\n';
  if (total === 0) {
    text += 'لا يوجد مستخدمين.';
  } else {
    text += '📌 الصفحة ' + page + ' من ' + totalPages + '\n\n';
    for (const uid of pageUsers) {
      const u = data.users[uid];
      text += '👤 <b>' + (u.name || 'غير معروف') + '</b>\n';
      text += '🆔 ' + uid + '\n';
      if (u.username) text += '📍 @' + u.username + '\n';
      if (u.phone) text += '📱 ' + u.phone + '\n';
      if (u.country) text += '🌍 ' + u.country + '\n';
      if (u.joined) text += '📅 انضم: ' + u.joined + '\n';
      if (u.lastUsed) text += '🕐 آخر استخدام: ' + u.lastUsed + '\n';
      text += '─────────────────\n';
    }
  }
  const buttons = [];
  if (totalPages > 1) {
    const nav = [];
    if (page > 1) nav.push({ text: '⬅️', callback_data: 'users_page_' + (page - 1) });
    nav.push({ text: page + '/' + totalPages, callback_data: 'users_page_' + page });
    if (page < totalPages) nav.push({ text: '➡️', callback_data: 'users_page_' + (page + 1) });
    buttons.push(nav);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
  return { text, keyboard: { inline_keyboard: buttons } };
}

function usersDeleteMenu() {
  const users = Object.keys(data.users || {});
  if (users.length === 0) {
    return { text: '⚠️ لا يوجد مستخدمين للحذف.', keyboard: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_users' }]] } };
  }
  const buttons = users.map(uid => [{ text: '🗑️ ' + (data.users[uid].name || uid), callback_data: 'users_delete_confirm_' + uid }]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
  return { text: '🗑️ <b>اختر مستخدم للحذف:</b>', keyboard: { inline_keyboard: buttons } };
}

function forcedSubscriptionMenu() {
  const fs = data.forcedSubscription;
  const status = fs.enabled ? '🟢 مفعل' : '🔴 معطل';
  const count = (fs.list || []).length;
  let listText = 'لا توجد اشتراكات.';
  if (count > 0) {
    listText = '';
    fs.list.forEach((s, i) => {
      const icon = s.enabled !== false ? '✅' : '❌';
      listText += (i+1) + '. ' + icon + ' ' + (s.name || s.type) + ' (' + s.type + ')\n';
    });
  }
  return {
    text: '🔗 <b>الاشتراك الإجباري</b>\n\n' +
          '📌 الحالة: ' + status + '\n' +
          '📋 عدد الاشتراكات: ' + count + '\n\n' +
          '━━━ <b>قائمة الاشتراكات</b> ━━━\n' + listText + '\n' +
          '━━━ <b>الإعدادات</b> ━━━\n' +
          '🔔 الإشعار: ' + (fs.settings.notification ? '🟢 مفعل' : '🔴 معطل') + '\n' +
          '📋 طريقة العرض: ' + (fs.settings.displayMode === 'grouped' ? 'مجمعة' : 'منفصلة') + '\n' +
          '🔘 زر التحقق: ' + fs.settings.verifyButtonText + '\n' +
          '✏️ رسالة العرض: ' + (fs.settings.groupedMessage || 'غير محددة') + '\n\n' +
          '🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 ' + (fs.enabled ? 'تعطيل' : 'تفعيل') + ' الكل', callback_data: 'fs_toggle_all' }],
        [{ text: '➕ إضافة اشتراك', callback_data: 'fs_add' }],
        [{ text: '✏️ تعديل اشتراك', callback_data: 'fs_edit' }],
        [{ text: '🗑️ حذف اشتراك', callback_data: 'fs_delete' }],
        [{ text: '⚙️ إعدادات الاشتراك', callback_data: 'fs_settings' }],
        [{ text: '👁️ معاينة البوابة', callback_data: 'fs_preview' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function forcedSubscriptionSettingsMenu() {
  const fs = data.forcedSubscription;
  return {
    text: '⚙️ <b>إعدادات الاشتراك الإجباري</b>\n\n' +
          '🔔 الإشعار: ' + (fs.settings.notification ? '🟢 مفعل' : '🔴 معطل') + '\n' +
          '📋 طريقة العرض: ' + (fs.settings.displayMode === 'grouped' ? 'مجمعة' : 'منفصلة') + '\n' +
          '🔘 زر التحقق: ' + fs.settings.verifyButtonText + '\n' +
          '✏️ رسالة العرض المجمع: \n' + (fs.settings.groupedMessage || 'غير محددة') + '\n\n' +
          '🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '🔔 ' + (fs.settings.notification ? 'تعطيل' : 'تفعيل') + ' الإشعار', callback_data: 'fs_setting_notification' }],
        [{ text: '📋 تغيير طريقة العرض', callback_data: 'fs_setting_display' }],
        [{ text: '✏️ تعديل زر التحقق', callback_data: 'fs_setting_verify_text' }],
        [{ text: '✏️ تعديل رسالة العرض', callback_data: 'fs_setting_grouped_message' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_forced_subscription' }]
      ]
    }
  };
}

function getWelcomeForUser(isNewUser, isPending, isVerified, isRejected) {
  const w = data.welcome;
  const buttons = [];
  if (isRejected) {
    return { text: '❌ <b>طلبك مرفوض.</b>\n\nإذا كان لديك استفسار، يرجى التواصل مع الإدارة.', image: null, buttons: null };
  }
  if (isPending) {
    return { text: '⏳ <b>طلبك قيد المراجعة.</b>\n\nيرجى الانتظار حتى يتم التحقق من طلبك.', image: null, buttons: null };
  }
  if (isVerified || !data.verification.enabled) {
    return { text: w.registeredMessage || '📦 <b>مرحباً بعودتك!</b>\n\nيمكنك استخدام البوت الآن.', image: null, buttons: null };
  }
  if (isNewUser || (!isVerified && data.verification.enabled)) {
    buttons.push([{ text: '▶️ بدء الاستخدام', callback_data: 'start_use' }]);
  }
  return { text: w.text, image: w.image, buttons: buttons };
}

// ====================================================================
// ========== معالج التحديثات الرئيسي ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    await loadData(env);
    setLogChannel(data.notifications.channelId);
    setLogEnabled(data.notifications.enabled);
    if (url.pathname === '/') return new Response('Bot running!');
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        await handleUpdate(body, env);
        return new Response('OK', { status: 200 });
      } catch (e) {
        console.error('Webhook error:', e);
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }
    if (url.pathname === '/setwebhook') {
      const token = env.BOT_TOKEN;
      const webhook = 'https://' + url.hostname + '/webhook';
      const res = await fetch('https://api.telegram.org/bot' + token + '/setWebhook?url=' + webhook);
      const result = await res.json();
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }
};

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

async function handleUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN = String(env.ADMIN_ID); // تأكد من تحويل إلى نص للمقارنة

  // ===== كولباك =====
  if (update.callback_query) {
    const q = update.callback_query;
    const userId = String(q.from.id);
    const cbData = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;

    // زر بدء الاستخدام
    if (cbData === 'start_use') {
      const user = data.users[userId] || {};
      await sendLog(userId, user.username, user.name, '▶️ بدء الاستخدام', 'بدأ المستخدم استخدام البوت', token);
      const fsOk = await checkForcedSubscription(userId, token);
      if (!fsOk) {
        await showForcedSubscription(chatId, userId, token);
        await answerCallback(q.id, '✅', token);
        return;
      }
      if (data.verification.enabled) {
        await sendMessage(chatId, data.verification.requestMessage, token, {
          reply_markup: {
            keyboard: [[{ text: data.verification.buttonText, request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      } else {
        await sendMessage(chatId, '📦 <b>المحتوى:</b>\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
      }
      await answerCallback(q.id, '✅', token);
      return;
    }

    // زر التحقق من الاشتراك
    if (cbData === 'check_subscription') {
      const fsOk = await checkForcedSubscription(userId, token);
      if (fsOk) {
        await sendMessage(chatId, '✅ <b>تم التحقق من اشتراكاتك!</b>\n\nيمكنك الآن استخدام البوت.', token);
        const welcome = getWelcomeForUser(false, false, true, false);
        if (welcome.image) {
          await sendPhoto(chatId, welcome.image, welcome.text, token, { reply_markup: { remove_keyboard: true } });
        } else {
          await sendMessage(chatId, welcome.text, token, { reply_markup: { remove_keyboard: true } });
        }
      } else {
        await showForcedSubscription(chatId, userId, token);
      }
      await answerCallback(q.id, '✅', token);
      return;
    }

    // زر الرابط (تم)
    if (cbData.startsWith('fs_link_done_')) {
      const linkId = cbData.replace('fs_link_done_', '');
      // تخزين أن المستخدم أكمل الرابط
      if (!data.forcedSubscription.userStatus) data.forcedSubscription.userStatus = {};
      if (!data.forcedSubscription.userStatus[userId]) data.forcedSubscription.userStatus[userId] = {};
      if (!data.forcedSubscription.userStatus[userId].links) data.forcedSubscription.userStatus[userId].links = {};
      data.forcedSubscription.userStatus[userId].links[linkId] = { completed: true, timestamp: Date.now() };
      await saveData(env);
      await sendMessage(chatId, '✅ تم تأكيد الرابط! جاري التحقق...', token);
      // إعادة التحقق
      const fsOk = await checkForcedSubscription(userId, token);
      if (fsOk) {
        await sendMessage(chatId, '✅ <b>تم التحقق من اشتراكاتك!</b>\n\nيمكنك الآن استخدام البوت.', token);
        const welcome = getWelcomeForUser(false, false, true, false);
        if (welcome.image) {
          await sendPhoto(chatId, welcome.image, welcome.text, token, { reply_markup: { remove_keyboard: true } });
        } else {
          await sendMessage(chatId, welcome.text, token, { reply_markup: { remove_keyboard: true } });
        }
      } else {
        await showForcedSubscription(chatId, userId, token);
      }
      await answerCallback(q.id, '✅', token);
      return;
    }

    // ===== معالجة كولباك الأدمن =====
    if (userId === ADMIN) {
      await handleAdminCallback(cbData, chatId, msgId, token, env);
      await answerCallback(q.id, '✅', token);
    } else {
      await sendMessage(chatId, '⚠️ هذا الإجراء للأدمن فقط', token);
    }
    return;
  }

  // ===== رسائل =====
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text || '';
    const username = msg.from.username || 'لا يوجد';
    const name = msg.from.first_name + ' ' + (msg.from.last_name || '');

    // تسجيل الإجراءات للمستخدمين غير الأدمن
    if (userId !== ADMIN && text) {
      await sendLog(userId, username, name, '📩 رسالة', 'أرسل: ' + text, token);
    }

    // ===== الأدمن =====
    if (userId === ADMIN) {
      // معالجة أوامر الأدمن النصية (تعديل النصوص، إلخ)
      await handleAdminInput(chatId, text, token, env);

      // بداية لوحة الأدمن
      if (text === '/start' || text === '/admin') {
        const menu = adminMenu();
        await sendMessage(chatId, menu.text, token, { reply_markup: menu.keyboard, bypass_protection: true });
      }
      return;
    }

    // ===== المستخدم العادي =====

    // معالجة رقم الهاتف (التحقق)
    if (msg.contact) {
      const contact = msg.contact;
      await sendLog(userId, username, name, '📱 مشاركة رقم', 'شارك رقم هاتفه للتحقق', token);
      if (data.verification.enabled) {
        if (data.verification.channelId) {
          const adminMsg = `
👤 <b>طلب تحقق جديد!</b>

👤 <b>الاسم:</b> ${name}
🆔 <b>اليوزرنيم:</b> @${username}
🆔 <b>المعرف:</b> ${userId}
📱 <b>رقم الهاتف:</b> ${contact.phone_number}

📌 اضغط للقبول أو الرفض:`;
          const kb = {
            inline_keyboard: [
              [
                { text: '✅ قبول', callback_data: 'verif_approve_' + userId },
                { text: '❌ رفض', callback_data: 'verif_reject_' + userId }
              ]
            ]
          };
          const result = await sendMessage(data.verification.channelId, adminMsg, token, { reply_markup: kb, bypass_protection: true });
          if (!result.ok) {
            console.error('❌ فشل إرسال الطلب للقناة:', result.description);
            await sendMessage(chatId, '⚠️ حدث خطأ في إرسال طلبك. يرجى المحاولة لاحقاً.', token);
            return;
          }
        } else {
          await sendMessage(chatId, '⚠️ لم يتم تعيين قناة للتحقق. يرجى التواصل مع الإدارة.', token);
          return;
        }
        if (!data.verification.pendingUsers) data.verification.pendingUsers = {};
        data.verification.pendingUsers[userId] = {
          name: name,
          username: username,
          phone: contact.phone_number,
          date: new Date().toISOString()
        };
        await saveData(env);
        await sendMessage(chatId, '⏳ تم استلام طلبك! جاري المراجعة...', token);
        return;
      }
      // إذا التحقق معطل، قد يكون مجرد رسالة عادية
      await sendMessage(chatId, '📦 <b>مرحباً!</b>\n\nيمكنك استخدام البوت.', token);
      return;
    }

    // معالجة /start
    if (text === '/start') {
      await sendLog(userId, username, name, '🔄 بدء', 'ضغط على /start', token);
      const isNewUser = !data.users[userId];
      const isPending = data.verification.pendingUsers && data.verification.pendingUsers[userId];
      const isVerified = data.verification.verifiedUsers && data.verification.verifiedUsers[userId];
      const isRejected = data.verification.rejectedUsers && data.verification.rejectedUsers[userId];

      if (isNewUser) {
        data.users[userId] = {
          name: name,
          username: username,
          joined: new Date().toLocaleString('ar-EG')
        };
        await saveData(env);
      } else {
        data.users[userId].lastUsed = new Date().toLocaleString('ar-EG');
        await saveData(env);
      }

      // التحقق من الاشتراك الإجباري للمستخدمين المسجلين
      if (!isNewUser && (isVerified || !data.verification.enabled)) {
        const fsOk = await checkForcedSubscription(userId, token);
        if (!fsOk) {
          await showForcedSubscription(chatId, userId, token);
          return;
        }
      }

      const welcome = getWelcomeForUser(isNewUser, isPending, isVerified, isRejected);
      if (welcome.image) {
        await sendPhoto(chatId, welcome.image, welcome.text, token, {
          reply_markup: welcome.buttons ? { inline_keyboard: welcome.buttons } : { remove_keyboard: true }
        });
      } else {
        await sendMessage(chatId, welcome.text, token, {
          reply_markup: welcome.buttons ? { inline_keyboard: welcome.buttons } : { remove_keyboard: true }
        });
      }
      return;
    }

    // الأوامر المخصصة
    const cmd = text.startsWith('/') ? text.substring(1) : null;
    if (cmd && data.commands && data.commands[cmd] && data.commands[cmd].enabled) {
      await sendLog(userId, username, name, '🔹 أمر مخصص', 'نفذ الأمر /' + cmd, token);
      await sendMessage(chatId, '🔹 ' + data.commands[cmd].description, token);
      return;
    }

    // رسالة غير معروفة
    await sendMessage(chatId, '❌ أمر غير معروف', token);
  }
}

// ====================================================================
// ========== معالجة إدخالات الأدمن النصية ==========
// ====================================================================

async function handleAdminInput(chatId, text, token, env) {
  // تعديل نص الترحيب
  if (adminState.action === 'edit_welcome' && adminState.step === 'text') {
    data.welcome.text = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = welcomeMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث النص', token);
    return;
  }

  // تعديل رسالة المستخدم المسجل
  if (adminState.action === 'edit_registered' && adminState.step === 'text') {
    data.welcome.registeredMessage = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = welcomeMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث رسالة المستخدم المسجل', token);
    return;
  }

  // تعديل رسالة الإيقاف
  if (adminState.action === 'edit_stop' && adminState.step === 'text') {
    data.settings.stopMessage = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = botSettingsMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث رسالة الإيقاف', token);
    return;
  }

  // تعديل رسائل التحقق
  if (adminState.action === 'edit_verif_msg' && adminState.step === 'text') {
    const field = adminState.temp.field;
    data.verification[field] = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = verificationMessagesMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث الرسالة', token);
    return;
  }

  // تعيين قناة التحقق
  if (adminState.action === 'set_verif_channel' && adminState.step === 'text') {
    const channelId = text.trim();
    const chatInfo = await getChatInfo(channelId, token);
    if (chatInfo) {
      data.verification.channelId = channelId;
      data.verification.channelName = chatInfo.name;
      await saveData(env);
      adminState.action = null;
      adminState.step = null;
      await sendMessage(channelId, '✅ <b>تم تعيين هذه القناة للتحقق من العضوية.</b>\n\nستصل طلبات التحقق الجديدة إلى هنا.', token, { bypass_protection: true });
      const menu = verificationMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, '✅ <b>تم تعيين قناة التحقق بنجاح!</b>\n\n📢 <b>اسم القناة:</b> ' + chatInfo.name + '\n🆔 <b>المعرف:</b> ' + channelId, token);
    } else {
      await sendMessage(chatId, '❌ <b>فشل تعيين القناة.</b>\n\nتأكد من صحة المعرف وأن البوت أدمن في القناة.', token);
    }
    return;
  }

  // تعيين قناة الإشعارات
  if (adminState.action === 'set_notif_channel' && adminState.step === 'text') {
    const channelId = text.trim();
    const chatInfo = await getChatInfo(channelId, token);
    if (chatInfo) {
      data.notifications.channelId = channelId;
      data.notifications.channelName = chatInfo.name;
      setLogChannel(channelId);
      await saveData(env);
      adminState.action = null;
      adminState.step = null;
      await sendMessage(channelId, '✅ <b>تم تعيين هذه القناة للإشعارات.</b>\n\nستصل جميع إجراءات المستخدمين إلى هنا.', token, { bypass_protection: true });
      const menu = notificationsMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, '✅ <b>تم تعيين قناة الإشعارات بنجاح!</b>\n\n📢 <b>اسم القناة:</b> ' + chatInfo.name + '\n🆔 <b>المعرف:</b> ' + channelId, token);
    } else {
      await sendMessage(chatId, '❌ <b>فشل تعيين القناة.</b>\n\nتأكد من صحة المعرف وأن البوت أدمن في القناة.', token);
    }
    return;
  }

  // إضافة مستخدم للتحقق
  if (adminState.action === 'verif_add_user' && adminState.step === 'text') {
    const targetId = text.trim();
    if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
    data.verification.verifiedUsers[targetId] = { name: 'مستخدم', date: new Date().toISOString() };
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    await sendMessage(chatId, '✅ تم إضافة المستخدم ' + targetId, token);
    const menu = verificationListMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // حذف مستخدم من التحقق
  if (adminState.action === 'verif_remove_user' && adminState.step === 'text') {
    const targetId = text.trim();
    if (data.verification.verifiedUsers && data.verification.verifiedUsers[targetId]) delete data.verification.verifiedUsers[targetId];
    if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) delete data.verification.rejectedUsers[targetId];
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    await sendMessage(chatId, '✅ تم حذف المستخدم ' + targetId, token);
    const menu = verificationListMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // إضافة أمر
  if (adminState.action === 'cmd_add' && adminState.step === 'cmd') {
    adminState.temp.cmd = text;
    adminState.step = 'desc';
    await sendMessage(chatId, '📝 <b>أدخل وصف الأمر:</b>', token);
    return;
  }
  if (adminState.action === 'cmd_add' && adminState.step === 'desc') {
    if (!data.commands) data.commands = {};
    data.commands[adminState.temp.cmd] = { description: text, enabled: true };
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    await updateBotCommands(token);
    const menu = commandsMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم إضافة الأمر /' + adminState.temp.cmd, token);
    return;
  }

  // تعديل أمر
  if (adminState.action === 'cmd_edit' && adminState.step === 'cmd') {
    const cmd = text.replace('/', '');
    if (data.commands && data.commands[cmd]) {
      adminState.temp.editCmd = cmd;
      adminState.step = 'desc';
      await sendMessage(chatId, '📝 <b>أدخل الوصف الجديد لـ /' + cmd + ':</b>\n\nالحالي: ' + data.commands[cmd].description, token);
    } else {
      await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
    }
    return;
  }
  if (adminState.action === 'cmd_edit' && adminState.step === 'desc') {
    const cmd = adminState.temp.editCmd;
    if (data.commands && data.commands[cmd]) {
      data.commands[cmd].description = text;
      await saveData(env);
      adminState.action = null;
      adminState.step = null;
      await updateBotCommands(token);
      const menu = commandsMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, '✅ تم تحديث /' + cmd, token);
    }
    return;
  }

  // حذف أمر
  if (adminState.action === 'cmd_delete' && adminState.step === 'cmd') {
    const cmd = text.replace('/', '');
    if (data.commands && data.commands[cmd]) {
      delete data.commands[cmd];
      await saveData(env);
      adminState.action = null;
      adminState.step = null;
      await updateBotCommands(token);
      const menu = commandsMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, '✅ تم حذف /' + cmd, token);
    } else {
      await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
    }
    return;
  }

  // تفعيل/تعطيل أمر
  if (adminState.action === 'cmd_toggle' && adminState.step === 'cmd') {
    const cmd = text.replace('/', '');
    if (data.commands && data.commands[cmd]) {
      data.commands[cmd].enabled = !data.commands[cmd].enabled;
      await saveData(env);
      adminState.action = null;
      adminState.step = null;
      await updateBotCommands(token);
      const menu = commandsMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      await sendMessage(chatId, '✅ تم ' + (data.commands[cmd].enabled ? 'تفعيل' : 'تعطيل') + ' /' + cmd, token);
    } else {
      await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
    }
    return;
  }

  // إعدادات الاشتراك الإجباري
  if (adminState.action === 'fs_setting_verify_text' && adminState.step === 'waiting_input') {
    data.forcedSubscription.settings.verifyButtonText = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث زر التحقق', token);
    return;
  }
  if (adminState.action === 'fs_setting_grouped_message' && adminState.step === 'waiting_input') {
    data.forcedSubscription.settings.groupedMessage = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '✅ تم تحديث رسالة العرض', token);
    return;
  }

  // إضافة اشتراك (استكمال البيانات)
  if (adminState.action === 'fs_add_data' && adminState.step === 'waiting_id') {
    const type = adminState.temp.type;
    const id = text.trim();
    adminState.temp.id = id;
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📝 <b>أدخل اسم الاشتراك:</b>', token);
    return;
  }
  if (adminState.action === 'fs_add_data' && adminState.step === 'waiting_name') {
    const name = text.trim();
    const type = adminState.temp.type;
    const id = adminState.temp.id;
    const newSub = {
      id: Date.now().toString(36),
      type: type,
      name: name,
      link: (type === 'link' ? id : (id.startsWith('@') || id.startsWith('-100') ? id : '@' + id)),
      enabled: true,
      order: (data.forcedSubscription.list || []).length + 1
    };
    if (!data.forcedSubscription.list) data.forcedSubscription.list = [];
    data.forcedSubscription.list.push(newSub);
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    await sendMessage(chatId, '✅ <b>تم إضافة الاشتراك بنجاح!</b>\n\n' +
                      '📌 النوع: ' + type + '\n' +
                      '📌 الاسم: ' + name + '\n' +
                      '📌 المعرف: ' + id, token);
    const menu = forcedSubscriptionMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // تعديل اشتراك (استكمال)
  if (adminState.action === 'fs_edit_data' && adminState.step === 'waiting_edit_value') {
    const index = adminState.temp.index;
    const field = adminState.temp.editField;
    const fs = data.forcedSubscription;
    if (!fs.list || !fs.list[index]) {
      await sendMessage(chatId, '⚠️ الاشتراك غير موجود.', token);
      return;
    }
    const sub = fs.list[index];
    if (field === 'name') sub.name = text;
    else if (field === 'link') sub.link = text;
    else if (field === 'message') sub.message = text;
    await saveData(env);
    adminState.action = null;
    adminState.step = null;
    await sendMessage(chatId, '✅ تم تحديث الاشتراك.', token);
    const menu = forcedSubscriptionMenu();
    await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // معالجة صورة الترحيب (يتم التعامل معها في handleUpdate)
  if (adminState.action === 'upload_welcome_image' && adminState.step === 'waiting_image') {
    await sendMessage(chatId, '❌ يرجى إرسال صورة، وليس نص.', token);
    return;
  }

  // أي إدخال آخر للأدمن - تجاهل
  // (لا نرسل رسالة خطأ هنا لأن البوت قد لا يتعرف على بعض الأوامر)
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(cbData, chatId, msgId, token, env) {
  // رجوع عام
  if (cbData === 'admin_back') {
    const menu = adminMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'settings_back') {
    const menu = settingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'verif_back') {
    const menu = verificationMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'admin_users') {
    const menu = usersMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'admin_forced_subscription') {
    const menu = forcedSubscriptionMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // الإعدادات
  if (cbData === 'admin_settings') {
    const menu = settingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // حالة البوت
  if (cbData === 'settings_bot_toggle') {
    const menu = botSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'bot_toggle') {
    data.settings.botActive = !data.settings.botActive;
    await saveData(env);
    const menu = botSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'bot_edit_stop') {
    adminState.action = 'edit_stop';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل رسالة الإيقاف الجديدة:</b>\n\nالحالية:\n' + data.settings.stopMessage, token);
    return;
  }

  // التحقق
  if (cbData === 'settings_verification') {
    const menu = verificationMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'verif_toggle') {
    data.verification.enabled = !data.verification.enabled;
    await saveData(env);
    const menu = verificationMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'verif_messages') {
    const menu = verificationMessagesMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'verif_msg_request') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId, field: 'requestMessage' };
    await sendMessage(chatId, '📝 <b>أدخل نص طلب الرقم الجديد:</b>\n\nالحالي:\n' + data.verification.requestMessage, token);
    return;
  }
  if (cbData === 'verif_msg_button') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId, field: 'buttonText' };
    await sendMessage(chatId, '📝 <b>أدخل نص زر المشاركة الجديد:</b>\n\nالحالي:\n' + data.verification.buttonText, token);
    return;
  }
  if (cbData === 'verif_msg_success') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId, field: 'successMessage' };
    await sendMessage(chatId, '📝 <b>أدخل رسالة النجاح الجديدة:</b>\n\nالحالية:\n' + data.verification.successMessage, token);
    return;
  }
  if (cbData === 'verif_msg_fail') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId, field: 'failMessage' };
    await sendMessage(chatId, '📝 <b>أدخل رسالة الرفض الجديدة:</b>\n\nالحالية:\n' + data.verification.failMessage, token);
    return;
  }
  if (cbData === 'verif_channel') {
    adminState.action = 'set_verif_channel';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل معرف قناة التحقق:</b>\n(يجب أن يكون البوت أدمن في القناة)', token);
    return;
  }
  if (cbData === 'verif_list') {
    const menu = verificationListMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'verif_list_verified') {
    const v = data.verification.verifiedUsers || {};
    const keys = Object.keys(v);
    let text = '✅ <b>المستخدمين المحققين</b>\n\n';
    if (keys.length === 0) text += 'لا يوجد مستخدمين محققين.';
    else keys.forEach(id => { text += '• ' + id + ' - ' + (v[id].name || 'غير معروف') + '\n'; });
    await sendMessage(chatId, text, token);
    return;
  }
  if (cbData === 'verif_list_rejected') {
    const v = data.verification.rejectedUsers || {};
    const keys = Object.keys(v);
    if (keys.length === 0) {
      await sendMessage(chatId, '❌ لا يوجد مستخدمين مرفوضين.', token);
      return;
    }
    const buttons = [];
    keys.forEach(id => {
      buttons.push([
        { text: '✅ إعادة قبول ' + id, callback_data: 'verif_reapprove_' + id },
        { text: '🗑️ حذف ' + id, callback_data: 'verif_delete_rejected_' + id }
      ]);
    });
    buttons.push([{ text: '🔙 رجوع', callback_data: 'verif_back' }]);
    await editMessage(chatId, msgId, '❌ <b>المستخدمين المرفوضين</b>\n\nاختر إجراء:', token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith('verif_reapprove_')) {
    const targetId = cbData.replace('verif_reapprove_', '');
    if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
      const user = data.verification.rejectedUsers[targetId];
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = { name: user.name, date: new Date().toISOString(), reapproved: true };
      delete data.verification.rejectedUsers[targetId];
      await saveData(env);
      await sendMessage(targetId, '✅ <b>تم إعادة قبول طلبك!</b>\n\n' + data.verification.successMessage, token);
      await sendMessage(targetId, '📦 <b>المحتوى:</b>\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
      // تحديث القائمة
      const newV = data.verification.rejectedUsers || {};
      const newKeys = Object.keys(newV);
      if (newKeys.length === 0) {
        await editMessage(chatId, msgId, '❌ لا يوجد مستخدمين مرفوضين.', token);
        return;
      }
      const buttons = [];
      newKeys.forEach(id => {
        buttons.push([
          { text: '✅ إعادة قبول ' + id, callback_data: 'verif_reapprove_' + id },
          { text: '🗑️ حذف ' + id, callback_data: 'verif_delete_rejected_' + id }
        ]);
      });
      buttons.push([{ text: '🔙 رجوع', callback_data: 'verif_back' }]);
      await editMessage(chatId, msgId, '❌ <b>المستخدمين المرفوضين</b>\n\nاختر إجراء:', token, { reply_markup: { inline_keyboard: buttons } });
    }
    return;
  }
  if (cbData.startsWith('verif_delete_rejected_')) {
    const targetId = cbData.replace('verif_delete_rejected_', '');
    if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
      delete data.verification.rejectedUsers[targetId];
      await saveData(env);
      const newV = data.verification.rejectedUsers || {};
      const newKeys = Object.keys(newV);
      if (newKeys.length === 0) {
        await editMessage(chatId, msgId, '❌ لا يوجد مستخدمين مرفوضين.', token);
        return;
      }
      const buttons = [];
      newKeys.forEach(id => {
        buttons.push([
          { text: '✅ إعادة قبول ' + id, callback_data: 'verif_reapprove_' + id },
          { text: '🗑️ حذف ' + id, callback_data: 'verif_delete_rejected_' + id }
        ]);
      });
      buttons.push([{ text: '🔙 رجوع', callback_data: 'verif_back' }]);
      await editMessage(chatId, msgId, '❌ <b>المستخدمين المرفوضين</b>\n\nاختر إجراء:', token, { reply_markup: { inline_keyboard: buttons } });
    }
    return;
  }
  if (cbData === 'verif_add_user') {
    adminState.action = 'verif_add_user';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل ID المستخدم للإضافة:</b>', token);
    return;
  }
  if (cbData === 'verif_remove_user') {
    adminState.action = 'verif_remove_user';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل ID المستخدم للحذف:</b>', token);
    return;
  }
  if (cbData.startsWith('verif_approve_')) {
    const targetId = cbData.replace('verif_approve_', '');
    if (data.verification.pendingUsers && data.verification.pendingUsers[targetId]) {
      const user = data.verification.pendingUsers[targetId];
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = { name: user.name, date: new Date().toISOString() };
      delete data.verification.pendingUsers[targetId];
      await saveData(env);
      await editMessage(chatId, msgId, '✅ <b>تم قبول المستخدم</b>\n\n' + user.name, token);
      await sendMessage(targetId, data.verification.successMessage, token);
      await sendMessage(targetId, '📦 <b>المحتوى:</b>\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
    }
    return;
  }
  if (cbData.startsWith('verif_reject_')) {
    const targetId = cbData.replace('verif_reject_', '');
    if (data.verification.pendingUsers && data.verification.pendingUsers[targetId]) {
      const user = data.verification.pendingUsers[targetId];
      if (!data.verification.rejectedUsers) data.verification.rejectedUsers = {};
      data.verification.rejectedUsers[targetId] = { name: user.name, date: new Date().toISOString() };
      delete data.verification.pendingUsers[targetId];
      await saveData(env);
      await editMessage(chatId, msgId, '❌ <b>تم رفض المستخدم</b>\n\n' + user.name, token);
      await sendMessage(targetId, data.verification.failMessage, token);
    }
    return;
  }

  // حماية المحتوى
  if (cbData === 'settings_protection') {
    const menu = protectionMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'protect_toggle') {
    data.protection.enabled = !data.protection.enabled;
    await saveData(env);
    const menu = protectionMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // الإشعارات
  if (cbData === 'settings_notifications') {
    const menu = notificationsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'notif_toggle') {
    data.notifications.enabled = !data.notifications.enabled;
    setLogEnabled(data.notifications.enabled);
    await saveData(env);
    const menu = notificationsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'notif_channel') {
    adminState.action = 'set_notif_channel';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل معرف قناة الإشعارات:</b>\n(يجب أن يكون البوت أدمن في القناة)', token);
    return;
  }

  // رسالة الترحيب
  if (cbData === 'admin_welcome') {
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'welcome_edit_text') {
    adminState.action = 'edit_welcome';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل نص الترحيب الجديد:</b>\n(يمكنك استخدام HTML)\n\nالحالي:\n' + data.welcome.text, token);
    return;
  }
  if (cbData === 'welcome_edit_image') {
    adminState.action = 'upload_welcome_image';
    adminState.step = 'waiting_image';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '🖼️ <b>أرسل الصورة الجديدة:</b>', token);
    return;
  }
  if (cbData === 'welcome_delete_image') {
    data.welcome.image = null;
    await saveData(env);
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '🗑️ تم حذف الصورة', token);
    return;
  }
  if (cbData === 'welcome_toggle_html') {
    data.welcome.useHtml = !data.welcome.useHtml;
    await saveData(env);
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '📄 تم ' + (data.welcome.useHtml ? 'تفعيل' : 'تعطيل') + ' وضع HTML', token);
    return;
  }
  if (cbData === 'welcome_edit_registered') {
    adminState.action = 'edit_registered';
    adminState.step = 'text';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل رسالة المستخدم المسجل الجديدة:</b>\n(يمكنك استخدام HTML)\n\nالحالية:\n' + data.welcome.registeredMessage, token);
    return;
  }
  if (cbData === 'welcome_preview') {
    const w = data.welcome;
    let previewText = '📋 <b>معاينة رسالة الترحيب</b>\n\n' +
                      '👤 <b>للمستخدم الجديد:</b>\n' + w.text + '\n\n' +
                      '👤 <b>للمستخدم المسجل:</b>\n' + w.registeredMessage;
    if (w.image) {
      previewText += '\n\n🖼️ <b>الصورة:</b> موجودة';
      await sendPhoto(chatId, w.image, previewText, token, { bypass_protection: true });
    } else {
      await sendMessage(chatId, previewText, token, { bypass_protection: true });
    }
    return;
  }

  // الأوامر
  if (cbData === 'admin_commands') {
    const menu = commandsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'cmd_add') {
    adminState.action = 'cmd_add';
    adminState.step = 'cmd';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر الجديد:</b>\n(بدون /)', token);
    return;
  }
  if (cbData === 'cmd_edit') {
    adminState.action = 'cmd_edit';
    adminState.step = 'cmd';
    adminState.temp = { chatId, msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للتعديل:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }
  if (cbData === 'cmd_delete') {
    adminState.action = 'cmd_delete';
    adminState.step = 'cmd';
    adminState.temp = { chatId, msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للحذف:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }
  if (cbData === 'cmd_toggle') {
    adminState.action = 'cmd_toggle';
    adminState.step = 'cmd';
    adminState.temp = { chatId, msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للتفعيل/التعطيل:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }

  // قسم المستخدمين
  if (cbData === 'admin_users') {
    const menu = usersMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'users_list') {
    const menu = usersListMenu(1);
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData.startsWith('users_page_')) {
    const page = parseInt(cbData.replace('users_page_', ''));
    const menu = usersListMenu(page);
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'users_delete') {
    const menu = usersDeleteMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData.startsWith('users_delete_confirm_')) {
    const targetId = cbData.replace('users_delete_confirm_', '');
    if (data.users && data.users[targetId]) {
      delete data.users[targetId];
      if (data.verification.verifiedUsers && data.verification.verifiedUsers[targetId]) delete data.verification.verifiedUsers[targetId];
      if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) delete data.verification.rejectedUsers[targetId];
      if (data.verification.pendingUsers && data.verification.pendingUsers[targetId]) delete data.verification.pendingUsers[targetId];
      await saveData(env);
      await sendMessage(chatId, '✅ <b>تم حذف المستخدم</b> ' + targetId, token);
      const menu = usersMenu();
      await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    } else {
      await sendMessage(chatId, '❌ المستخدم غير موجود', token);
    }
    return;
  }

  // الاشتراك الإجباري
  if (cbData === 'admin_forced_subscription') {
    const menu = forcedSubscriptionMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'fs_toggle_all') {
    data.forcedSubscription.enabled = !data.forcedSubscription.enabled;
    await saveData(env);
    const menu = forcedSubscriptionMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'fs_add') {
    adminState.action = 'fs_add_type';
    adminState.step = 'choose_type';
    adminState.temp = { chatId, msgId };
    const types = [
      { text: '📢 قناة عامة', data: 'fs_type_channel' },
      { text: '🔒📢 قناة خاصة', data: 'fs_type_channel_private' },
      { text: '👥 مجموعة عامة', data: 'fs_type_group' },
      { text: '🔒👥 مجموعة خاصة', data: 'fs_type_group_private' },
      { text: '🤖 بوت', data: 'fs_type_bot' },
      { text: '🔗 رابط', data: 'fs_type_link' }
    ];
    const buttons = types.map(t => [{ text: t.text, callback_data: t.data }]);
    buttons.push([{ text: '🔙 إلغاء', callback_data: 'admin_forced_subscription' }]);
    await sendMessage(chatId, '📝 <b>اختر نوع الاشتراك:</b>', token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith('fs_type_')) {
    const type = cbData.replace('fs_type_', '');
    adminState.action = 'fs_add_data';
    adminState.step = 'waiting_id';
    adminState.temp.type = type;
    adminState.temp.chatId = chatId;
    adminState.temp.msgId = msgId;
    let prompt = '';
    if (type === 'channel' || type === 'channel_private') {
      prompt = '📢 <b>أدخل معرف القناة:</b>\n' +
               (type === 'channel' ? '(مثل: @channel)' : '(أرسل توجيه لرسالة من القناة)');
    } else if (type === 'group' || type === 'group_private') {
      prompt = '👥 <b>أدخل معرف المجموعة:</b>\n' +
               (type === 'group' ? '(مثل: @group)' : '(أرسل ID المجموعة)');
    } else if (type === 'bot') {
      prompt = '🤖 <b>أدخل معرف البوت:</b>\n(مثل: @bot أو username)';
    } else if (type === 'link') {
      prompt = '🔗 <b>أدخل الرابط:</b>\n(مثل: https://youtube.com/...)';
    }
    await sendMessage(chatId, prompt, token);
    return;
  }
  if (cbData === 'fs_edit') {
    const fs = data.forcedSubscription;
    if (!fs.list || fs.list.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد اشتراكات لتعديلها.', token);
      return;
    }
    const buttons = fs.list.map((s, i) => {
      return [{ text: '✏️ ' + (s.name || s.type + ' ' + (i+1)), callback_data: 'fs_edit_select_' + i }];
    });
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_forced_subscription' }]);
    await editMessage(chatId, msgId, '✏️ <b>اختر اشتراكاً لتعديله:</b>', token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith('fs_edit_select_')) {
    const index = parseInt(cbData.replace('fs_edit_select_', ''));
    const fs = data.forcedSubscription;
    if (!fs.list || !fs.list[index]) {
      await sendMessage(chatId, '⚠️ الاشتراك غير موجود.', token);
      return;
    }
    const sub = fs.list[index];
    adminState.action = 'fs_edit_data';
    adminState.step = 'choose_field';
    adminState.temp = { index, chatId, msgId };
    const buttons = [
      [{ text: '✏️ الاسم', callback_data: 'fs_edit_field_name' }],
      [{ text: '✏️ الرابط', callback_data: 'fs_edit_field_link' }],
      [{ text: '✏️ الرسالة', callback_data: 'fs_edit_field_message' }],
      [{ text: '🔄 ' + (sub.enabled !== false ? 'تعطيل' : 'تفعيل'), callback_data: 'fs_edit_field_toggle' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_forced_subscription' }]
    ];
    await editMessage(chatId, msgId, '✏️ <b>تعديل الاشتراك:</b> ' + (sub.name || sub.type) + '\n\nاختر الحقل:', token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith('fs_edit_field_')) {
    const field = cbData.replace('fs_edit_field_', '');
    const index = adminState.temp.index;
    const fs = data.forcedSubscription;
    if (!fs.list || !fs.list[index]) {
      await sendMessage(chatId, '⚠️ الاشتراك غير موجود.', token);
      return;
    }
    const sub = fs.list[index];
    adminState.step = 'waiting_edit_value';
    adminState.temp.editField = field;
    let prompt = '';
    if (field === 'name') prompt = '📝 <b>أدخل الاسم الجديد:</b>\nالحالي: ' + (sub.name || 'غير محدد');
    else if (field === 'link') prompt = '🔗 <b>أدخل الرابط الجديد:</b>\nالحالي: ' + (sub.link || 'غير محدد');
    else if (field === 'message') prompt = '✏️ <b>أدخل الرسالة الجديدة:</b>\nالحالي: ' + (sub.message || 'غير محدد');
    else if (field === 'toggle') {
      sub.enabled = sub.enabled === undefined ? false : !sub.enabled;
      await saveData(env);
      await sendMessage(chatId, '🔄 تم ' + (sub.enabled ? 'تفعيل' : 'تعطيل') + ' الاشتراك.', token);
      const menu = forcedSubscriptionMenu();
      await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
      return;
    }
    await sendMessage(chatId, prompt, token);
    return;
  }
  if (cbData === 'fs_delete') {
    const fs = data.forcedSubscription;
    if (!fs.list || fs.list.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد اشتراكات لحذفها.', token);
      return;
    }
    const buttons = fs.list.map((s, i) => {
      return [{ text: '🗑️ ' + (s.name || s.type + ' ' + (i+1)), callback_data: 'fs_delete_confirm_' + i }];
    });
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_forced_subscription' }]);
    await editMessage(chatId, msgId, '🗑️ <b>اختر اشتراكاً للحذف:</b>', token, { reply_markup: { inline_keyboard: buttons } });
    return;
  }
  if (cbData.startsWith('fs_delete_confirm_')) {
    const index = parseInt(cbData.replace('fs_delete_confirm_', ''));
    const fs = data.forcedSubscription;
    if (fs.list && fs.list[index]) {
      const removed = fs.list.splice(index, 1);
      await saveData(env);
      await sendMessage(chatId, '🗑️ تم حذف الاشتراك: ' + (removed[0].name || removed[0].type), token);
      const menu = forcedSubscriptionMenu();
      await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    } else {
      await sendMessage(chatId, '⚠️ الاشتراك غير موجود.', token);
    }
    return;
  }
  if (cbData === 'fs_settings') {
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'fs_setting_notification') {
    data.forcedSubscription.settings.notification = !data.forcedSubscription.settings.notification;
    await saveData(env);
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'fs_setting_display') {
    const current = data.forcedSubscription.settings.displayMode || 'grouped';
    data.forcedSubscription.settings.displayMode = (current === 'grouped' ? 'separate' : 'grouped');
    await saveData(env);
    const menu = forcedSubscriptionSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  if (cbData === 'fs_setting_verify_text') {
    adminState.action = 'fs_setting_verify_text';
    adminState.step = 'waiting_input';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '🔘 <b>أدخل النص الجديد لزر التحقق:</b>\n\nالحالي: ' + data.forcedSubscription.settings.verifyButtonText, token);
    return;
  }
  if (cbData === 'fs_setting_grouped_message') {
    adminState.action = 'fs_setting_grouped_message';
    adminState.step = 'waiting_input';
    adminState.temp = { chatId, msgId };
    await sendMessage(chatId, '✏️ <b>أدخل رسالة العرض المجمع الجديدة:</b>\n(يمكنك استخدام HTML)\n\nالحالية: ' + (data.forcedSubscription.settings.groupedMessage || 'غير محددة'), token);
    return;
  }
  if (cbData === 'fs_preview') {
    const fs = data.forcedSubscription;
    const activeSubs = fs.list.filter(s => s.enabled !== false);
    if (activeSubs.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد اشتراكات نشطة للمعاينة.', token);
      return;
    }
    const previewText = fs.settings.groupedMessage || '📢 <b>يجب عليك الاشتراك في القنوات التالية:</b>';
    const keyboard = getForcedSubscriptionKeyboard('preview');
    if (keyboard) {
      await sendMessage(chatId, '👁️ <b>معاينة بوابة الاشتراك</b>\n\n' + previewText, token, { reply_markup: keyboard });
    } else {
      await sendMessage(chatId, '👁️ <b>معاينة بوابة الاشتراك</b>\n\n' + previewText + '\n\n(لا توجد اشتراكات نشطة)', token);
    }
    return;
  }

  // إلغاء
  if (cbData === 'cancel') {
    adminState.action = null;
    adminState.step = null;
    adminState.temp = {};
    const menu = adminMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // أي كولباك غير معروف
  await sendMessage(chatId, '⚠️ خيار غير معروف', token);
}
