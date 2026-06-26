// ====================================================================
// ========== بوت تيليجرام - نسخة مبسطة ==========
// ====================================================================

// ========== التخزين المؤقت ==========
let botData = {
  welcome: {
    text: '🎉 مرحباً بك في البوت!\n\nاختر ما تريد:',
    buttons: [
      { text: '📚 عن البوت', action: 'about' },
      { text: '🔍 بحث', action: 'search' }
    ]
  },
  commands: {},
  users: {},
  content: {}
};

const adminState = { action: null, step: null, temp: {} };
const KV_KEYS = {
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
    const welcome = await env.KV_NAMESPACE.get(KV_KEYS.WELCOME, 'json');
    if (welcome) botData.welcome = welcome;
    
    const commands = await env.KV_NAMESPACE.get(KV_KEYS.COMMANDS, 'json');
    if (commands) botData.commands = commands;
    
    const users = await env.KV_NAMESPACE.get(KV_KEYS.USERS, 'json');
    if (users) botData.users = users;
    
    const content = await env.KV_NAMESPACE.get(KV_KEYS.CONTENT, 'json');
    if (content) botData.content = content;
    
    console.log('✅ Data loaded');
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function saveData(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.WELCOME, JSON.stringify(botData.welcome));
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify(botData.commands));
    await env.KV_NAMESPACE.put(KV_KEYS.USERS, JSON.stringify(botData.users));
    await env.KV_NAMESPACE.put(KV_KEYS.CONTENT, JSON.stringify(botData.content));
    console.log('✅ Data saved');
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
  if (extra) {
    Object.assign(payload, extra);
  }
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
  if (extra) {
    Object.assign(payload, extra);
  }
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

// ====================================================================
// ========== قوائم الأدمن ==========
// ====================================================================

function adminMainMenu() {
  return {
    text: '🔹 **لوحة التحكم**\n\nاختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ رسالة الترحيب', callback_data: 'admin_welcome' }],
        [{ text: '📋 إدارة الأوامر', callback_data: 'admin_commands' }]
      ]
    }
  };
}

function welcomeSettingsMenu() {
  const w = botData.welcome;
  let btnText = 'لا توجد أزرار';
  if (w.buttons && w.buttons.length > 0) {
    btnText = w.buttons.map(b => '• ' + b.text + ' ➜ ' + b.action).join('\n');
  }
  
  return {
    text: '✏️ **رسالة الترحيب**\n\n📝 **النص:**\n' + w.text + '\n\n🔘 **الأزرار:**\n' + btnText + '\n\n🔹 اختر الإجراء:',
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ تعديل النص', callback_data: 'welcome_edit_text' }],
        [{ text: '➕ إضافة زر', callback_data: 'welcome_add_btn' }],
        [{ text: '🗑️ حذف زر', callback_data: 'welcome_del_btn' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };
}

function commandsSettingsMenu() {
  let text = '📋 **إدارة الأوامر**\n\n';
  
  const cmdKeys = Object.keys(botData.commands || {});
  if (cmdKeys.length === 0) {
    text += 'لا توجد أوامر مخصصة.\n';
  } else {
    cmdKeys.forEach(k => {
      text += '• /' + k + ' - ' + botData.commands[k].description + ' ' + (botData.commands[k].enabled ? '✅' : '❌') + '\n';
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

function getUserWelcome() {
  const w = botData.welcome;
  const buttons = (w.buttons || []).map(b => [{ text: b.text, callback_data: 'w_' + b.action }]);
  return {
    text: w.text,
    keyboard: { inline_keyboard: buttons }
  };
}

// ====================================================================
// ========== معالجة الأوامر ==========
// ====================================================================

async function handleCustomCommand(chatId, cmd, token) {
  const command = botData.commands[cmd];
  if (command) {
    await sendMessage(chatId, command.response || '🔹 تم تنفيذ الأمر /' + cmd, token);
  } else {
    await sendMessage(chatId, '❌ الأمر /' + cmd + ' غير معروف', token);
  }
}

async function handleUserAction(chatId, action, token) {
  // البحث عن الزر في رسالة الترحيب
  const btn = (botData.welcome.buttons || []).find(b => b.action === action);
  if (btn && btn.response) {
    await sendMessage(chatId, btn.response, token);
  } else if (action === 'about') {
    await sendMessage(chatId, '📌 **عن البوت**\n\nبوت لمشاهدة المحتوى.', token);
  } else if (action === 'search') {
    await sendMessage(chatId, '🔍 **أرسل رقم المحتوى:**', token);
  } else {
    await sendMessage(chatId, '🔹 ' + action, token);
  }
}

// ====================================================================
// ========== معالجة كولباك الأدمن ==========
// ====================================================================

async function handleAdminCallback(data, chatId, msgId, token, env) {
  // رجوع
  if (data === 'admin_back') {
    const menu = adminMainMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  // رسالة الترحيب
  if (data === 'admin_welcome') {
    const menu = welcomeSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (data === 'welcome_edit_text') {
    adminState.action = 'edit_welcome';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل نص الترحيب الجديد:**\n\nالحالي:\n' + botData.welcome.text, token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'welcome_add_btn') {
    adminState.action = 'add_btn';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل نص الزر الجديد:**', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'welcome_del_btn') {
    const btns = botData.welcome.buttons || [];
    if (btns.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أزرار', token);
      return;
    }
    const kb = { inline_keyboard: [] };
    btns.forEach((b, i) => {
      kb.inline_keyboard.push([{ text: '🗑️ ' + b.text, callback_data: 'wel_del_' + i }]);
    });
    kb.inline_keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_welcome' }]);
    await editMessage(chatId, msgId, '🗑️ **اختر زراً للحذف:**', token, { reply_markup: kb });
    return;
  }
  
  if (data.startsWith('wel_del_')) {
    const idx = parseInt(data.replace('wel_del_', ''));
    const btns = botData.welcome.buttons || [];
    if (idx >= 0 && idx < btns.length) {
      btns.splice(idx, 1);
      botData.welcome.buttons = btns;
      await saveData(env);
    }
    const menu = welcomeSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  // الأوامر
  if (data === 'admin_commands') {
    const menu = commandsSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (data === 'cmd_add') {
    adminState.action = 'cmd_add';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل اسم الأمر الجديد:**\n(بدون /)', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'cmd_edit') {
    adminState.action = 'cmd_edit';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(botData.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر للتعديل', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتعديل:**\n\nالمتاحة:\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'cmd_delete') {
    adminState.action = 'cmd_delete';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(botData.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر للحذف', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للحذف:**\n\nالمتاحة:\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'cmd_toggle') {
    adminState.action = 'cmd_toggle';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = Object.keys(botData.commands || {});
    if (all.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أوامر', token);
      return;
    }
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتفعيل/التعطيل:**\n\nالمتاحة:\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  // إلغاء
  if (data === 'cancel') {
    adminState.action = null;
    adminState.step = null;
    adminState.temp = {};
    const menu = adminMainMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  await sendMessage(chatId, '⚠️ خيار غير معروف', token);
}

// ====================================================================
// ========== معالج التحديثات الرئيسي ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    await loadData(env);
    
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
        return new Response('Error', { status: 500 });
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
    const data = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;
    
    // كولباك المستخدم (أزرار الترحيب)
    if (data.startsWith('w_')) {
      const action = data.replace('w_', '');
      await handleUserAction(chatId, action, token);
      await answerCallback(q.id, '✅', token);
      return;
    }
    
    // كولباك الأدمن
    if (userId === ADMIN) {
      await handleAdminCallback(data, chatId, msgId, token, env);
      await answerCallback(q.id, '✅', token);
    }
    return;
  }
  
  // ===== رسائل =====
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = msg.text;
    
    // ===== الأدمن =====
    if (userId === ADMIN) {
      // معالجة إدخالات الأدمن
      if (adminState.action === 'edit_welcome' && adminState.step === 'text') {
        botData.welcome.text = text;
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = welcomeSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث النص', token);
        return;
      }
      
      if (adminState.action === 'add_btn' && adminState.step === 'text') {
        adminState.temp.btnText = text;
        adminState.step = 'action';
        await sendMessage(chatId, '📝 **أدخل الإجراء للزر:**\n(مثل: about, search)', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'add_btn' && adminState.step === 'action') {
        adminState.step = 'response';
        adminState.temp.btnAction = text;
        await sendMessage(chatId, '📝 **أدخل الرد عند الضغط على الزر:**', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'add_btn' && adminState.step === 'response') {
        if (!botData.welcome.buttons) {
          botData.welcome.buttons = [];
        }
        botData.welcome.buttons.push({ 
          text: adminState.temp.btnText, 
          action: adminState.temp.btnAction,
          response: text
        });
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = welcomeSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم إضافة الزر', token);
        return;
      }
      
      if (adminState.action === 'cmd_add' && adminState.step === 'cmd') {
        adminState.temp.cmd = text;
        adminState.step = 'desc';
        await sendMessage(chatId, '📝 **أدخل وصف الأمر:**', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'cmd_add' && adminState.step === 'desc') {
        adminState.step = 'response';
        adminState.temp.desc = text;
        await sendMessage(chatId, '📝 **أدخل رد الأمر عند تنفيذه:**', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'cmd_add' && adminState.step === 'response') {
        if (!botData.commands) {
          botData.commands = {};
        }
        botData.commands[adminState.temp.cmd] = { 
          description: adminState.temp.desc, 
          response: text,
          enabled: true 
        };
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = commandsSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم إضافة الأمر /' + adminState.temp.cmd, token);
        return;
      }
      
      if (adminState.action === 'cmd_edit' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        if (botData.commands && botData.commands[cmd]) {
          adminState.temp.editCmd = cmd;
          adminState.step = 'desc';
          await sendMessage(chatId, '📝 **أدخل الوصف الجديد لـ /' + cmd + ':**\n\nالحالي: ' + botData.commands[cmd].description, token, {
            reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
          });
        } else {
          await sendMessage(chatId, '❌ الأمر /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      if (adminState.action === 'cmd_edit' && adminState.step === 'desc') {
        adminState.temp.newDesc = text;
        adminState.step = 'response';
        await sendMessage(chatId, '📝 **أدخل الرد الجديد لـ /' + adminState.temp.editCmd + ':**\n\nالحالي: ' + botData.commands[adminState.temp.editCmd].response, token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'cmd_edit' && adminState.step === 'response') {
        const cmd = adminState.temp.editCmd;
        if (botData.commands && botData.commands[cmd]) {
          botData.commands[cmd].description = adminState.temp.newDesc;
          botData.commands[cmd].response = text;
        }
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = commandsSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث /' + cmd, token);
        return;
      }
      
      if (adminState.action === 'cmd_delete' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        if (botData.commands && botData.commands[cmd]) {
          delete botData.commands[cmd];
          await saveData(env);
          adminState.action = null;
          adminState.step = null;
          const menu = commandsSettingsMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم حذف /' + cmd, token);
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      if (adminState.action === 'cmd_toggle' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        if (botData.commands && botData.commands[cmd]) {
          botData.commands[cmd].enabled = !botData.commands[cmd].enabled;
          await saveData(env);
          adminState.action = null;
          adminState.step = null;
          const menu = commandsSettingsMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم ' + (botData.commands[cmd].enabled ? 'تفعيل' : 'تعطيل') + ' /' + cmd, token);
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      // بداية لوحة الأدمن
      if (text === '/start' || text === '/admin') {
        const menu = adminMainMenu();
        await sendMessage(chatId, menu.text, token, { reply_markup: menu.keyboard });
      }
      return;
    }
    
    // ===== المستخدم العادي =====
    if (text === '/start') {
      const welcome = getUserWelcome();
      await sendMessage(chatId, welcome.text, token, { reply_markup: welcome.keyboard });
      return;
    }
    
    // الأوامر المخصصة
    const cmd = text.startsWith('/') ? text.substring(1) : null;
    if (cmd) {
      if (botData.commands && botData.commands[cmd] && botData.commands[cmd].enabled) {
        await handleCustomCommand(chatId, cmd, token);
        return;
      }
      await sendMessage(chatId, '❌ الأمر /' + cmd + ' غير معروف', token);
      return;
    }
    
    // بحث عن محتوى
    const content = botData.content[text];
    if (content) {
      await sendMessage(chatId, content, token);
    } else {
      await sendMessage(chatId, '❌ لا يوجد محتوى بهذا الرقم', token);
    }
  }
}
