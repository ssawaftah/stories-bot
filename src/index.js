// ====================================================================
// ========== بوت تيليجرام ==========
// ====================================================================

import { sendLog, setLogChannel, setLogEnabled, isLogEnabled } from './modules/logger.js';

let data = {
  settings: {
    botActive: true,
    stopMessage: '⏸️ البوت متوقف حالياً. يرجى المحاولة لاحقاً.'
  },
  verification: {
    enabled: false,
    channelId: null,
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
    channelId: null
  },
  welcome: {
    text: '🎉 مرحباً بك في البوت!'
  },
  commands: {},
  users: {},
  content: {}
};

const adminState = { action: null, step: null, temp: {} };
const KV_KEYS = {
  SETTINGS: 'bot_settings',
  VERIFICATION: 'bot_verification',
  PROTECTION: 'bot_protection',
  NOTIFICATIONS: 'bot_notifications',
  WELCOME: 'bot_welcome',
  COMMANDS: 'bot_commands',
  USERS: 'bot_users',
  CONTENT: 'bot_content'
};

// ====================================================================
// ========== دوال KV ==========
// ====================================================================

async function loadData(env) {
  try {
    const settings = await env.KV_NAMESPACE.get(KV_KEYS.SETTINGS, 'json');
    if (settings) data.settings = settings;
    
    const verification = await env.KV_NAMESPACE.get(KV_KEYS.VERIFICATION, 'json');
    if (verification) data.verification = verification;
    
    const protection = await env.KV_NAMESPACE.get(KV_KEYS.PROTECTION, 'json');
    if (protection) data.protection = protection;
    
    const notifications = await env.KV_NAMESPACE.get(KV_KEYS.NOTIFICATIONS, 'json');
    if (notifications) {
      data.notifications = notifications;
      setLogChannel(notifications.channelId);
      setLogEnabled(notifications.enabled);
    }
    
    const welcome = await env.KV_NAMESPACE.get(KV_KEYS.WELCOME, 'json');
    if (welcome) data.welcome = welcome;
    
    const commands = await env.KV_NAMESPACE.get(KV_KEYS.COMMANDS, 'json');
    if (commands) data.commands = commands;
    
    const users = await env.KV_NAMESPACE.get(KV_KEYS.USERS, 'json');
    if (users) data.users = users;
    
    const content = await env.KV_NAMESPACE.get(KV_KEYS.CONTENT, 'json');
    if (content) data.content = content;
    
    console.log('✅ All data loaded');
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function saveData(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.SETTINGS, JSON.stringify(data.settings));
    await env.KV_NAMESPACE.put(KV_KEYS.VERIFICATION, JSON.stringify(data.verification));
    await env.KV_NAMESPACE.put(KV_KEYS.PROTECTION, JSON.stringify(data.protection));
    await env.KV_NAMESPACE.put(KV_KEYS.NOTIFICATIONS, JSON.stringify(data.notifications));
    await env.KV_NAMESPACE.put(KV_KEYS.WELCOME, JSON.stringify(data.welcome));
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify(data.commands));
    await env.KV_NAMESPACE.put(KV_KEYS.USERS, JSON.stringify(data.users));
    await env.KV_NAMESPACE.put(KV_KEYS.CONTENT, JSON.stringify(data.content));
    console.log('✅ All data saved');
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// ====================================================================
// ========== دوال مساعدة ==========
// ====================================================================

async function sendMessage(chatId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
  if (extra) Object.assign(payload, extra);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error('Send error:', e);
    return { ok: false };
  }
}

async function editMessage(chatId, msgId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/editMessageText';
  const payload = { chat_id: chatId, message_id: msgId, text: text, parse_mode: 'Markdown' };
  if (extra) Object.assign(payload, extra);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error('Edit error:', e);
    return { ok: false };
  }
}

async function answerCallback(cbId, text, token) {
  const url = 'https://api.telegram.org/bot' + token + '/answerCallbackQuery';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId, text: text || '✅' })
    });
  } catch (e) {
    console.error('Callback error:', e);
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
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: commands })
    });
  } catch (e) {
    console.error('Error updating commands:', e);
  }
}

// ====================================================================
// ========== قوائم الأدمن ==========
// ====================================================================

function adminMenu() {
  return {
    text: '🔹 **لوحة التحكم**\n\nاختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '⚙️ الإعدادات', callback_data: 'admin_settings' }],
        [{ text: '✏️ رسالة الترحيب', callback_data: 'admin_welcome' }],
        [{ text: '📋 إدارة الأوامر', callback_data: 'admin_commands' }]
      ]
    }
  };
}

function settingsMenu() {
  const botStatus = data.settings.botActive ? '🟩 البوت يعمل' : '🟥 البوت متوقف';
  const verStatus = data.verification.enabled ? '🟩 التحقق من العضوية نشط' : '🟥 التحقق من العضوية متوقف';
  const protectStatus = data.protection.enabled ? '🔒 الحماية مفعلة' : '🔓 الحماية معطلة';
  const notifStatus = data.notifications.enabled ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة';
  
  return {
    text: '⚙️ **الإعدادات**\n\nاختر القسم:',
    keyboard: {
      inline_keyboard: [
        [{ text: botStatus, callback_data: 'settings_bot_toggle' }],
        [{ text: verStatus, callback_data: 'settings_verification' }],
        [{ text: protectStatus, callback_data: 'settings_protection' }],
        [{ text: notifStatus, callback_data: 'settings_notifications' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function botSettingsMenu() {
  const status = data.settings.botActive ? '🟩 البوت يعمل' : '🟥 البوت متوقف';
  return {
    text: '🤖 **حالة البوت**\n\n📌 الحالية: ' + status + '\n\nرسالة الإيقاف الحالية:\n' + data.settings.stopMessage,
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
  const channel = v.channelId || 'غير محدد';
  
  return {
    text: '✅ **التحقق من العضوية**\n\n📌 الحالة: ' + status + '\n📢 قناة التحقق: ' + channel + '\n\n🔹 اختر الإجراء:',
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
    text: '✏️ **رسائل التحقق**\n\n📝 **طلب الرقم:**\n' + v.requestMessage + '\n\n🔘 **زر المشاركة:**\n' + v.buttonText + '\n\n✅ **رسالة النجاح:**\n' + v.successMessage + '\n\n❌ **رسالة الرفض:**\n' + v.failMessage,
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
    text: '📋 **قائمة التحقق**\n\n✅ المحققين: ' + verified.length + '\n❌ المرفوضين: ' + rejected.length,
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
    text: '🔒 **حماية المحتوى**\n\n📌 الحالية: ' + status + '\n\nعند التفعيل، سيمنع المستخدمون من حفظ رسائل البوت وتوجيهها.',
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
  const channel = data.notifications.channelId || 'غير محدد';
  
  return {
    text: '🔔 **الإشعارات والأحداثيات**\n\n📌 الحالة: ' + status + '\n📢 القناة: ' + channel + '\n\nعند التفعيل، ستصل جميع إجراءات المستخدمين إلى القناة المحددة.',
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
  return {
    text: '✏️ **رسالة الترحيب**\n\n📝 **النص الحالي:**\n' + data.welcome.text + '\n\n🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ تعديل النص', callback_data: 'welcome_edit_text' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function commandsMenu() {
  let text = '📋 **إدارة الأوامر**\n\n';
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

function getUserWelcome(isNewUser) {
  const text = data.welcome.text;
  const buttons = [];
  
  // زر بدء الاستخدام للمستخدمين الجدد فقط
  if (isNewUser) {
    buttons.push([{ text: '▶️ بدء الاستخدام', callback_data: 'start_use' }]);
  }
  
  return {
    text: text,
    keyboard: { inline_keyboard: buttons }
  };
}

// ====================================================================
// ========== معالج التحديثات الرئيسي ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    await loadData(env);
    
    // تحديث إعدادات الإشعارات
    setLogChannel(data.notifications.channelId);
    setLogEnabled(data.notifications.enabled);
    
    if (url.pathname === '/') {
      return new Response('Bot running!');
    }
    
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
  const ADMIN = env.ADMIN_ID;
  
  // ===== كولباك =====
  if (update.callback_query) {
    const q = update.callback_query;
    const userId = String(q.from.id);
    const cbData = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;
    
    // زر بدء الاستخدام
    if (cbData === 'start_use') {
      // تسجيل الإجراء
      const user = data.users[userId] || {};
      await sendLog(userId, user.username, user.name, '▶️ بدء الاستخدام', 'بدأ المستخدم استخدام البوت', token);
      
      // التحقق من العضوية
      if (data.verification.enabled) {
        await sendMessage(chatId, data.verification.requestMessage, token, {
          reply_markup: {
            keyboard: [[{ text: data.verification.buttonText, request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      } else {
        await sendMessage(chatId, '📦 **المحتوى:**\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
      }
      await answerCallback(q.id, '✅', token);
      return;
    }
    
    // أزرار المستخدم
    if (cbData.startsWith('w_')) {
      const action = cbData.replace('w_', '');
      await sendMessage(chatId, '🔹 تم الضغط على: ' + action, token);
      await answerCallback(q.id, '✅', token);
      return;
    }
    
    // أدمن
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
    const text = msg.text;
    const username = msg.from.username || 'لا يوجد';
    const name = msg.from.first_name + ' ' + (msg.from.last_name || '');
    
    // تسجيل الإجراء (للمستخدمين)
    if (userId !== ADMIN) {
      await sendLog(userId, username, name, '📩 رسالة', 'أرسل: ' + (text || 'وسائط'), token);
    }
    
    // ===== الأدمن =====
    if (userId === ADMIN) {
      // تعديل نص الترحيب
      if (adminState.action === 'edit_welcome' && adminState.step === 'text') {
        data.welcome.text = text;
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        const menu = welcomeMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث النص', token);
        return;
      }
      
      // تعديل رسالة الإيقاف
      if (adminState.action === 'edit_stop' && adminState.step === 'text') {
        data.settings.stopMessage = text;
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        const menu = botSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث رسالة الإيقاف', token);
        return;
      }
      
      // تعديل رسائل التحقق
      if (adminState.action === 'edit_verif_msg' && adminState.step === 'text') {
        const field = adminState.temp.field;
        data.verification[field] = text;
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        const menu = verificationMessagesMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث الرسالة', token);
        return;
      }
      
      // تعيين قناة التحقق
      if (adminState.action === 'set_verif_channel' && adminState.step === 'text') {
        data.verification.channelId = text.trim();
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        const menu = verificationMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تعيين قناة التحقق: ' + text, token);
        return;
      }
      
      // تعيين قناة الإشعارات
      if (adminState.action === 'set_notif_channel' && adminState.step === 'text') {
        data.notifications.channelId = text.trim();
        setLogChannel(text.trim());
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        const menu = notificationsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تعيين قناة الإشعارات: ' + text, token);
        return;
      }
      
      // إضافة مستخدم للتحقق
      if (adminState.action === 'verif_add_user' && adminState.step === 'text') {
        const targetId = text.trim();
        if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
        data.verification.verifiedUsers[targetId] = { name: 'مستخدم', date: new Date().toISOString() };
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        await sendMessage(chatId, '✅ تم إضافة المستخدم ' + targetId, token);
        const menu = verificationListMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        return;
      }
      
      // حذف مستخدم من التحقق
      if (adminState.action === 'verif_remove_user' && adminState.step === 'text') {
        const targetId = text.trim();
        if (data.verification.verifiedUsers && data.verification.verifiedUsers[targetId]) {
          delete data.verification.verifiedUsers[targetId];
        }
        if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
          delete data.verification.rejectedUsers[targetId];
        }
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
        await sendMessage(chatId, '✅ تم حذف المستخدم ' + targetId, token);
        const menu = verificationListMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        return;
      }
      
      // إضافة أمر
      if (adminState.action === 'cmd_add' && adminState.step === 'cmd') {
        adminState.temp.cmd = text;
        adminState.step = 'desc';
        await sendMessage(chatId, '📝 **أدخل وصف الأمر:**', token);
        return;
      }
      
      if (adminState.action === 'cmd_add' && adminState.step === 'desc') {
        if (!data.commands) data.commands = {};
        data.commands[adminState.temp.cmd] = { description: text, enabled: true };
        adminState.action = null;
        adminState.step = null;
        await saveData(env);
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
          await sendMessage(chatId, '📝 **أدخل الوصف الجديد لـ /' + cmd + ':**\n\nالحالي: ' + data.commands[cmd].description, token);
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      if (adminState.action === 'cmd_edit' && adminState.step === 'desc') {
        const cmd = adminState.temp.editCmd;
        if (data.commands && data.commands[cmd]) {
          data.commands[cmd].description = text;
          adminState.action = null;
          adminState.step = null;
          await saveData(env);
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
          adminState.action = null;
          adminState.step = null;
          await saveData(env);
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
          adminState.action = null;
          adminState.step = null;
          await saveData(env);
          await updateBotCommands(token);
          const menu = commandsMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم ' + (data.commands[cmd].enabled ? 'تفعيل' : 'تعطيل') + ' /' + cmd, token);
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      // بداية لوحة الأدمن
      if (text === '/start' || text === '/admin') {
        const menu = adminMenu();
        await sendMessage(chatId, menu.text, token, { reply_markup: menu.keyboard });
      }
      return;
    }
    
    // ===== المستخدم =====
    
    // معالجة رقم الهاتف (التحقق)
    if (msg.contact) {
      const contact = msg.contact;
      
      // تسجيل الإجراء
      await sendLog(userId, username, name, '📱 مشاركة رقم', 'شارك رقم هاتفه للتحقق', token);
      
      // التحقق من العضوية
      if (data.verification.enabled) {
        // إرسال الطلب للقناة
        if (data.verification.channelId) {
          const adminMsg = `
👤 **طلب تحقق جديد!**

👤 **الاسم:** ${name}
🆔 **اليوزرنيم:** @${username}
🆔 **المعرف:** ${userId}
📱 **رقم الهاتف:** ${contact.phone_number}

📌 اضغط للقبول أو الرفض:`;

          const kb = {
            inline_keyboard: [
              [
                { text: '✅ قبول', callback_data: 'verif_approve_' + userId },
                { text: '❌ رفض', callback_data: 'verif_reject_' + userId }
              ]
            ]
          };
          
          await sendMessage(data.verification.channelId, adminMsg, token, { reply_markup: kb });
        }
        
        // تخزين الطلب pending
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
    }
    
    // المستخدم الجديد - /start
    if (text === '/start') {
      // تسجيل الإجراء
      await sendLog(userId, username, name, '🔄 بدء', 'ضغط على /start', token);
      
      // التحقق من وجود المستخدم
      const isNewUser = !data.users[userId];
      if (isNewUser) {
        data.users[userId] = { name: name, username: username, joined: new Date().toISOString() };
        await saveData(env);
      }
      
      const welcome = getUserWelcome(isNewUser);
      await sendMessage(chatId, welcome.text, token, { reply_markup: welcome.keyboard });
      return;
    }
    
    // الأوامر المخصصة
    const cmd = text.startsWith('/') ? text.substring(1) : null;
    if (cmd && data.commands && data.commands[cmd] && data.commands[cmd].enabled) {
      await sendLog(userId, username, name, '🔹 أمر مخصص', 'نفذ الأمر /' + cmd, token);
      await sendMessage(chatId, '🔹 ' + data.commands[cmd].description, token);
      return;
    }
    
    await sendMessage(chatId, '❌ أمر غير معروف', token);
  }
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(cbData, chatId, msgId, token, env) {
  // ===== رجوع =====
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
  
  // ===== الإعدادات =====
  if (cbData === 'admin_settings') {
    const menu = settingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  // ===== حالة البوت =====
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
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل رسالة الإيقاف الجديدة:**\n\nالحالية:\n' + data.settings.stopMessage, token);
    return;
  }
  
  // ===== التحقق من العضوية =====
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
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'requestMessage' };
    await sendMessage(chatId, '📝 **أدخل نص طلب الرقم الجديد:**\n\nالحالي:\n' + data.verification.requestMessage, token);
    return;
  }
  
  if (cbData === 'verif_msg_button') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'buttonText' };
    await sendMessage(chatId, '📝 **أدخل نص زر المشاركة الجديد:**\n\nالحالي:\n' + data.verification.buttonText, token);
    return;
  }
  
  if (cbData === 'verif_msg_success') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'successMessage' };
    await sendMessage(chatId, '📝 **أدخل رسالة النجاح الجديدة:**\n\nالحالية:\n' + data.verification.successMessage, token);
    return;
  }
  
  if (cbData === 'verif_msg_fail') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'failMessage' };
    await sendMessage(chatId, '📝 **أدخل رسالة الرفض الجديدة:**\n\nالحالية:\n' + data.verification.failMessage, token);
    return;
  }
  
  if (cbData === 'verif_channel') {
    adminState.action = 'set_verif_channel';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل معرف قناة التحقق:**\n(يجب أن يكون البوت أدمن في القناة)', token);
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
    let text = '✅ **المستخدمين المحققين**\n\n';
    if (keys.length === 0) {
      text += 'لا يوجد مستخدمين محققين.';
    } else {
      keys.forEach(id => {
        text += '• ' + id + ' - ' + (v[id].name || 'غير معروف') + '\n';
      });
    }
    await sendMessage(chatId, text, token);
    return;
  }
  
  if (cbData === 'verif_list_rejected') {
    const v = data.verification.rejectedUsers || {};
    const keys = Object.keys(v);
    let text = '❌ **المستخدمين المرفوضين**\n\n';
    if (keys.length === 0) {
      text += 'لا يوجد مستخدمين مرفوضين.';
    } else {
      keys.forEach(id => {
        text += '• ' + id + ' - ' + (v[id].name || 'غير معروف') + '\n';
      });
    }
    text += '\n🔹 يمكنك إعادة قبولهم من قائمة المرفوضين.';
    await sendMessage(chatId, text, token);
    return;
  }
  
  if (cbData === 'verif_add_user') {
    adminState.action = 'verif_add_user';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل ID المستخدم للإضافة:**', token);
    return;
  }
  
  if (cbData === 'verif_remove_user') {
    adminState.action = 'verif_remove_user';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل ID المستخدم للحذف:**', token);
    return;
  }
  
  // ===== قبول/رفض التحقق من القناة =====
  if (cbData.startsWith('verif_approve_')) {
    const targetId = cbData.replace('verif_approve_', '');
    if (data.verification.pendingUsers && data.verification.pendingUsers[targetId]) {
      const user = data.verification.pendingUsers[targetId];
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = { name: user.name, date: new Date().toISOString() };
      delete data.verification.pendingUsers[targetId];
      await saveData(env);
      
      // تحديث رسالة القناة
      await editMessage(chatId, msgId, '✅ **تم قبول المستخدم**\n\n' + user.name, token);
      
      // إرسال رسالة نجاح للمستخدم
      await sendMessage(targetId, data.verification.successMessage, token);
      await sendMessage(targetId, '📦 **المحتوى:**\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
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
      
      // تحديث رسالة القناة
      await editMessage(chatId, msgId, '❌ **تم رفض المستخدم**\n\n' + user.name, token);
      
      // إرسال رسالة رفض للمستخدم
      await sendMessage(targetId, data.verification.failMessage, token);
    }
    return;
  }
  
  // ===== حماية المحتوى =====
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
  
  // ===== الإشعارات =====
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
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل معرف قناة الإشعارات:**\n(يجب أن يكون البوت أدمن في القناة)', token);
    return;
  }
  
  // ===== رسالة الترحيب =====
  if (cbData === 'admin_welcome') {
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'welcome_edit_text') {
    adminState.action = 'edit_welcome';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل نص الترحيب الجديد:**\n\nالحالي:\n' + data.welcome.text, token);
    return;
  }
  
  // ===== الأوامر =====
  if (cbData === 'admin_commands') {
    const menu = commandsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'cmd_add') {
    adminState.action = 'cmd_add';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل اسم الأمر الجديد:**\n(بدون /)', token);
    return;
  }
  
  if (cbData === 'cmd_edit') {
    adminState.action = 'cmd_edit';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتعديل:**\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }
  
  if (cbData === 'cmd_delete') {
    adminState.action = 'cmd_delete';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للحذف:**\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }
  
  if (cbData === 'cmd_toggle') {
    adminState.action = 'cmd_toggle';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(data.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتفعيل/التعطيل:**\n\n' + all.map(c => '• /' + c).join('\n'), token);
    return;
  }
  
  if (cbData === 'cancel') {
    adminState.action = null;
    adminState.step = null;
    adminState.temp = {};
    const menu = adminMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  await sendMessage(chatId, '⚠️ خيار غير معروف', token);
}
