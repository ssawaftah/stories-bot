// ====================================================================
// ========== التخزين المؤقت ==========
// ====================================================================

let data = {
  users: { pending: {}, rejected: {}, approved: {} },
  settings: {
    isActive: true,
    stopMessage: '⏸️ البوت متوقف حالياً.',
    botLink: 'https://t.me/teeeesrydtbot?start=default',
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
      { command: 'start', description: 'بدء استخدام البوت', enabled: true },
      { command: 'help', description: 'الحصول على المساعدة', enabled: true },
      { command: 'about', description: 'معلومات عن البوت', enabled: true }
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
    if (settingsData) data.settings = { ...data.settings, ...settingsData };
    const welcomeData = await env.KV_NAMESPACE.get(KV_KEYS.WELCOME, 'json');
    if (welcomeData) data.welcome = welcomeData;
    const commandsData = await env.KV_NAMESPACE.get(KV_KEYS.COMMANDS, 'json');
    if (commandsData) data.commands = commandsData;
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
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify(data.commands));
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
      [{ text: `🔄 ${welcome.enabled ? 'تعطيل' : 'تفعيل'} الرسالة`, callback_data: 'welcome_toggle' }],
      [{ text: '✏️ تعديل النص', callback_data: 'welcome_edit_text' }],
      [{ text: '➕ إضافة زر', callback_data: 'welcome_add_button' }],
      [{ text: '🗑️ حذف زر', callback_data: 'welcome_remove_button' }],
      [{ text: '📋 معاينة الرسالة', callback_data: 'welcome_preview' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

function getCommandsSettingsMenu() {
  const commands = data.commands.list;
  const customCommands = data.commands.custom || {};
  
  let text = `📋 **إدارة الأوامر**

📌 **الأوامر المدمجة:**
`;
  commands.forEach(cmd => {
    text += `• /${cmd.command} - ${cmd.description} ${cmd.enabled ? '✅' : '❌'}\n`;
  });

  const customKeys = Object.keys(customCommands);
  if (customKeys.length > 0) {
    text += `\n📌 **الأوامر المخصصة:**\n`;
    customKeys.forEach(key => {
      text += `• /${key} - ${customCommands[key].description} ${customCommands[key].enabled ? '✅' : '❌'}\n`;
    });
  }

  text += `\n🔹 اختر الإجراء:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '✏️ تعديل أمر', callback_data: 'commands_edit' }],
      [{ text: '➕ إضافة أمر مخصص', callback_data: 'commands_add' }],
      [{ text: '🗑️ حذف أمر', callback_data: 'commands_delete' }],
      [{ text: '🔄 تفعيل/تعطيل أمر', callback_data: 'commands_toggle' }],
      [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
    ]
  };

  return { text, keyboard };
}

function getAdminMainMenu() {
  const stats = data.settings.stats;
  const text = `
📊 **لوحة تحكم البوت**

📈 **إحصائيات اليوم:**
👥 المستخدمين: ${Object.keys(data.users.approved).length}
🆕 المستخدمين الجدد: ${stats.newUsersToday || 0}
💬 عدد الرسائل الإجمالي: ${stats.totalMessages || 0}
📌 الجلسات: ${stats.sessions || 0}

🔹 **اختر الإجراء:**`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '✏️ رسالة الترحيب', callback_data: 'admin_welcome' }],
      [{ text: '📋 إدارة الأوامر', callback_data: 'admin_commands' }],
      [{ text: '⚙️ الإعدادات', callback_data: 'admin_settings' }],
      [{ text: '📋 إدارة الطلبات', callback_data: 'admin_requests' }],
      [{ text: '📦 إدارة المحتوى', callback_data: 'admin_content' }]
    ]
  };

  return { text, keyboard };
}

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // تحديث الإعدادات
    data.settings.logChannel = env.LOG_CHANNEL_ID || 'ineswangelogs';
    await loadAllData(env);
    
    if (url.pathname === '/') {
      return new Response('Bot is running!', { headers: { 'Content-Type': 'text/plain' } });
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
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleTelegramUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN_ID = env.ADMIN_ID;

  try {
    // ===== معالجة الكولباك =====
    if (update.callback_query) {
      const query = update.callback_query;
      const userId = query.from.id;
      const data_cb = query.data;
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;

      if (userId.toString() === ADMIN_ID) {
        await handleAdminCallback(data_cb, chatId, messageId, token, env);
        await answerCallbackQuery(query.id, '✅ تم', token);
        return;
      }
      
      // معالجة كولباك المستخدم (أزرار الترحيب)
      if (data_cb.startsWith('welcome_btn_')) {
        const action = data_cb.replace('welcome_btn_', '');
        await handleWelcomeButton(chatId, action, token, userId);
        await answerCallbackQuery(query.id, '✅ تم', token);
        return;
      }
      return;
    }

    // ===== معالجة الرسائل =====
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
        if (adminState.currentAction === 'edit_welcome_text' && adminState.step === 'waiting_input') {
          data.welcome.text = text;
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          const menu = getWelcomeSettingsMenu();
          await editMessage(adminState.tempData.chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم تحديث نص الترحيب', token);
          return;
        }

        if (adminState.currentAction === 'welcome_add_button' && adminState.step === 'waiting_text') {
          adminState.tempData.buttonText = text;
          adminState.step = 'waiting_action';
          await sendMessage(chatId, '📝 **أدخل الإجراء للزر:**\n(مثال: search, about, help)', token, {
            reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
          });
          return;
        }

        if (adminState.currentAction === 'welcome_add_button' && adminState.step === 'waiting_action') {
          data.welcome.buttons.push({ text: adminState.tempData.buttonText, action: text });
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          adminState.tempData = {};
          const menu = getWelcomeSettingsMenu();
          await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم إضافة الزر', token);
          return;
        }

        if (adminState.currentAction === 'commands_add' && adminState.step === 'waiting_command') {
          adminState.tempData.newCommand = text;
          adminState.step = 'waiting_description';
          await sendMessage(chatId, '📝 **أدخل وصف الأمر:**', token, {
            reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
          });
          return;
        }

        if (adminState.currentAction === 'commands_add' && adminState.step === 'waiting_description') {
          if (!data.commands.custom) data.commands.custom = {};
          data.commands.custom[adminState.tempData.newCommand] = { description: text, enabled: true };
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          adminState.tempData = {};
          const menu = getCommandsSettingsMenu();
          await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, `✅ تم إضافة الأمر /${adminState.tempData.newCommand}`, token);
          return;
        }

        if (adminState.currentAction === 'commands_edit' && adminState.step === 'waiting_command') {
          const cmd = text.startsWith('/') ? text.substring(1) : text;
          const allCommands = [...data.commands.list, ...Object.keys(data.commands.custom || {}).map(k => ({ command: k, ...data.commands.custom[k] }))];
          const found = allCommands.find(c => c.command === cmd);
          if (found) {
            adminState.tempData.editCommand = cmd;
            adminState.step = 'waiting_new_description';
            await sendMessage(chatId, `📝 **أدخل الوصف الجديد للأمر /${cmd}:**\n\nالحالي: ${found.description}`, token, {
              reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
            });
          } else {
            await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود`, token);
          }
          return;
        }

        if (adminState.currentAction === 'commands_edit' && adminState.step === 'waiting_new_description') {
          const cmd = adminState.tempData.editCommand;
          const builtin = data.commands.list.find(c => c.command === cmd);
          if (builtin) {
            builtin.description = text;
          } else if (data.commands.custom && data.commands.custom[cmd]) {
            data.commands.custom[cmd].description = text;
          }
          await saveAllData(env);
          adminState.currentAction = null;
          adminState.step = null;
          adminState.tempData = {};
          const menu = getCommandsSettingsMenu();
          await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, `✅ تم تحديث وصف الأمر /${cmd}`, token);
          return;
        }

        if (adminState.currentAction === 'commands_delete' && adminState.step === 'waiting_command') {
          const cmd = text.startsWith('/') ? text.substring(1) : text;
          if (data.commands.custom && data.commands.custom[cmd]) {
            delete data.commands.custom[cmd];
            await saveAllData(env);
            adminState.currentAction = null;
            adminState.step = null;
            const menu = getCommandsSettingsMenu();
            await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
            await sendMessage(chatId, `✅ تم حذف الأمر /${cmd}`, token);
          } else {
            await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود أو لا يمكن حذفه`, token);
          }
          return;
        }

        if (adminState.currentAction === 'commands_toggle' && adminState.step === 'waiting_command') {
          const cmd = text.startsWith('/') ? text.substring(1) : text;
          const builtin = data.commands.list.find(c => c.command === cmd);
          if (builtin) {
            builtin.enabled = !builtin.enabled;
            await saveAllData(env);
            adminState.currentAction = null;
            adminState.step = null;
            const menu = getCommandsSettingsMenu();
            await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
            await sendMessage(chatId, `✅ تم ${builtin.enabled ? 'تفعيل' : 'تعطيل'} الأمر /${cmd}`, token);
          } else if (data.commands.custom && data.commands.custom[cmd]) {
            data.commands.custom[cmd].enabled = !data.commands.custom[cmd].enabled;
            await saveAllData(env);
            adminState.currentAction = null;
            adminState.step = null;
            const menu = getCommandsSettingsMenu();
            await editMessage(adminState.tempData.chatId || chatId, adminState.tempData.messageId, menu.text, token, { reply_markup: menu.keyboard });
            await sendMessage(chatId, `✅ تم ${data.commands.custom[cmd].enabled ? 'تفعيل' : 'تعطيل'} الأمر /${cmd}`, token);
          } else {
            await sendMessage(chatId, `❌ الأمر /${cmd} غير موجود`, token);
          }
          return;
        }

        return;
      }

      // ========== واجهة المستخدم ==========
      if (!data.settings.isActive) {
        await sendMessage(chatId, data.settings.stopMessage, token);
        return;
      }

      if (text === '/start') {
        // عرض رسالة الترحيب المخصصة
        const menu = getWelcomeMenu();
        await sendMessage(chatId, menu.text, token, { reply_markup: menu.keyboard });
        return;
      }

      // معالجة الأوامر المخصصة
      const cmd = text.startsWith('/') ? text.substring(1) : null;
      if (cmd) {
        // التحقق من الأوامر المدمجة
        const builtin = data.commands.list.find(c => c.command === cmd && c.enabled);
        if (builtin) {
          await handleBuiltinCommand(chatId, cmd, token);
          return;
        }
        // التحقق من الأوامر المخصصة
        if (data.commands.custom && data.commands.custom[cmd] && data.commands.custom[cmd].enabled) {
          await sendMessage(chatId, data.commands.custom[cmd].description || `🔹 هذا هو الأمر /${cmd}`, token);
          return;
        }
        await sendMessage(chatId, `❌ الأمر /${cmd} غير معروف`, token);
        return;
      }

      // البحث عن محتوى
      const contentId = text.trim();
      const item = data.content.items[contentId];
      if (item) {
        await sendMessage(chatId, `${item.title}\n\n${item.content}`, token);
      } else {
        await sendMessage(chatId, '❌ لا يوجد محتوى بهذا الرقم', token);
      }
    }
  } catch (error) {
    console.error('Error in handleTelegramUpdate:', error);
  }
}

// ====================================================================
// ========== معالجة الأوامر المدمجة ==========
// ====================================================================

async function handleBuiltinCommand(chatId, cmd, token) {
  if (cmd === 'help') {
    let text = '🆘 **قائمة المساعدة:**\n\n';
    const allCommands = [
      ...data.commands.list.filter(c => c.enabled),
      ...Object.keys(data.commands.custom || {}).filter(k => data.commands.custom[k].enabled).map(k => ({ command: k, description: data.commands.custom[k].description }))
    ];
    allCommands.forEach(c => {
      text += `• /${c.command} - ${c.description}\n`;
    });
    await sendMessage(chatId, text, token);
  } else if (cmd === 'about') {
    await sendMessage(chatId, '📌 **عن البوت**\n\nبوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته', token);
  } else if (cmd === 'search') {
    await sendMessage(chatId, '🔍 **أرسل رقم المحتوى الذي تريد مشاهدته:**', token);
  } else {
    await sendMessage(chatId, '❌ الأمر غير معروف', token);
  }
}

// ====================================================================
// ========== معالجة أزرار الترحيب ==========
// ====================================================================

async function handleWelcomeButton(chatId, action, token, userId) {
  if (action === 'search') {
    await sendMessage(chatId, '🔍 **أرسل رقم المحتوى:**', token);
  } else if (action === 'about') {
    await sendMessage(chatId, '📌 **عن البوت**\n\nبوت رفع ومشاهدة المحتوى', token);
  } else if (action === 'help') {
    await handleBuiltinCommand(chatId, 'help', token);
  } else {
    await sendMessage(chatId, `🔹 تم الضغط على زر: ${action}`, token);
  }
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(data_cb, chatId, messageId, token, env) {
  // ===== رجوع =====
  if (data_cb === 'admin_back') {
    const menu = getAdminMainMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== رسالة الترحيب =====
  if (data_cb === 'admin_welcome') {
    const menu = getWelcomeSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data_cb === 'welcome_toggle') {
    data.welcome.enabled = !data.welcome.enabled;
    await saveAllData(env);
    const menu = getWelcomeSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data_cb === 'welcome_edit_text') {
    adminState.currentAction = 'edit_welcome_text';
    adminState.step = 'waiting_input';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, `📝 **أدخل نص الترحيب الجديد:**\n\nالحالي:\n${data.welcome.text}`, token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  if (data_cb === 'welcome_add_button') {
    adminState.currentAction = 'welcome_add_button';
    adminState.step = 'waiting_text';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, '📝 **أدخل نص الزر الجديد:**', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  if (data_cb === 'welcome_remove_button') {
    const buttons = data.welcome.buttons;
    if (buttons.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أزرار لحذفها', token);
      return;
    }
    const btnKeyboard = {
      inline_keyboard: buttons.map((b, i) => [{ text: `🗑️ ${b.text}`, callback_data: `welcome_remove_btn_${i}` }])
    };
    btnKeyboard.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_welcome' }]);
    await editMessage(chatId, messageId, '🗑️ **اختر الزر للحذف:**', token, { reply_markup: btnKeyboard });
    return;
  }

  if (data_cb.startsWith('welcome_remove_btn_')) {
    const index = parseInt(data_cb.replace('welcome_remove_btn_', ''));
    data.welcome.buttons.splice(index, 1);
    await saveAllData(env);
    const menu = getWelcomeSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data_cb === 'welcome_preview') {
    const menu = getWelcomeMenu();
    await sendMessage(chatId, '📋 **معاينة رسالة الترحيب:**\n\n' + menu.text, token);
    return;
  }

  // ===== إدارة الأوامر =====
  if (data_cb === 'admin_commands') {
    const menu = getCommandsSettingsMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  if (data_cb === 'commands_edit') {
    adminState.currentAction = 'commands_edit';
    adminState.step = 'waiting_command';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتعديل:**\n(مثال: start, help, about)', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  if (data_cb === 'commands_add') {
    adminState.currentAction = 'commands_add';
    adminState.step = 'waiting_command';
    adminState.tempData = { chatId, messageId };
    await sendMessage(chatId, '📝 **أدخل اسم الأمر الجديد:**\n(بدون /)', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  if (data_cb === 'commands_delete') {
    adminState.currentAction = 'commands_delete';
    adminState.step = 'waiting_command';
    adminState.tempData = { chatId, messageId };
    const allCmds = [...data.commands.list.map(c => c.command), ...Object.keys(data.commands.custom || {})];
    await sendMessage(chatId, `📝 **أدخل اسم الأمر للحذف:**\n\nالأوامر المتاحة:\n${allCmds.map(c => `• /${c}`).join('\n')}`, token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  if (data_cb === 'commands_toggle') {
    adminState.currentAction = 'commands_toggle';
    adminState.step = 'waiting_command';
    adminState.tempData = { chatId, messageId };
    const allCmds = [...data.commands.list.map(c => c.command), ...Object.keys(data.commands.custom || {})];
    await sendMessage(chatId, `📝 **أدخل اسم الأمر للتفعيل/التعطيل:**\n\nالأوامر المتاحة:\n${allCmds.map(c => `• /${c}`).join('\n')}`, token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }

  // ===== إلغاء =====
  if (data_cb === 'cancel') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    const menu = getAdminMainMenu();
    await editMessage(chatId, messageId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }

  // ===== إعدادات أخرى (مختصرة) =====
  if (data_cb === 'admin_settings') {
    await sendMessage(chatId, '⚙️ **الإعدادات**\n\n🔹 قيد التطوير...', token);
    return;
  }

  if (data_cb === 'admin_requests') {
    await sendMessage(chatId, '📋 **إدارة الطلبات**\n\n🔹 قيد التطوير...', token);
    return;
  }

  if (data_cb === 'admin_content') {
    await sendMessage(chatId, '📦 **إدارة المحتوى**\n\n🔹 قيد التطوير...', token);
    return;
  }

  await sendMessage(chatId, '⚠️ خيار غير معروف', token);
}
