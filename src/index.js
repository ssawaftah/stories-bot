// ====================================================================
// ========== بوت تيليجرام - نسخة جديدة ==========
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
  commands: {
    list: [
      { command: 'start', description: 'بدء استخدام البوت', enabled: true },
      { command: 'about', description: 'معلومات عن البوت', enabled: true },
      { command: 'search', description: 'البحث عن محتوى', enabled: true }
    ],
    custom: {}
  },
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
    if (commands) {
      const basicCommands = [
        { command: 'start', description: 'بدء استخدام البوت', enabled: true },
        { command: 'about', description: 'معلومات عن البوت', enabled: true },
        { command: 'search', description: 'البحث عن محتوى', enabled: true }
      ];
      const savedList = commands.list || [];
      const merged = basicCommands.map(bc => {
        const found = savedList.find(s => s.command === bc.command);
        return found || bc;
      });
      const custom = savedList.filter(s => !basicCommands.find(b => b.command === s.command));
      botData.commands.list = [...merged, ...custom];
      botData.commands.custom = commands.custom || {};
    }
    
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
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify({ list: botData.commands.list, custom: botData.commands.custom }));
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
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
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
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
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
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
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
  const text = `
📊 **لوحة التحكم**

👥 المستخدمين: ${Object.keys(botData.users).length}
📦 المحتوى: ${Object.keys(botData.content).length}

🔹 اختر الإجراء:`;

  return {
    text: text,
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ رسالة الترحيب', callback_data: 'admin_welcome' }],
        [{ text: '📋 إدارة الأوامر', callback_data: 'admin_commands' }],
        [{ text: '📦 إدارة المحتوى', callback_data: 'admin_content' }]
      ]
    }
  };
}

function welcomeSettingsMenu() {
  const w = botData.welcome;
  let btnText = 'لا توجد أزرار';
  if (w.buttons && w.buttons.length > 0) {
    btnText = w.buttons.map(b => `• ${b.text} ➜ ${b.action}`).join('\n');
  }
  
  return {
    text: `
✏️ **رسالة الترحيب**

📝 **النص:**
${w.text}

🔘 **الأزرار:**
${btnText}

🔹 اختر الإجراء:`,
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
  
  if (botData.commands.list && botData.commands.list.length > 0) {
    botData.commands.list.forEach(c => {
      text += `• /${c.command} - ${c.description} ${c.enabled ? '✅' : '❌'}\n`;
    });
  }
  
  const custom = Object.keys(botData.commands.custom || {});
  if (custom.length > 0) {
    text += '\n📌 **المخصصة:**\n';
    custom.forEach(k => {
      text += `• /${k} - ${botData.commands.custom[k].description} ${botData.commands.custom[k].enabled ? '✅' : '❌'}\n`;
    });
  }
  
  text += '\n🔹 اختر الإجراء:';
  
  return {
    text: text,
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ تعديل أمر', callback_data: 'cmd_edit' }],
        [{ text: '➕ إضافة أمر', callback_data: 'cmd_add' }],
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

async function handleCommand(chatId, cmd, token) {
  if (cmd === 'about') {
    await sendMessage(chatId, '📌 **عن البوت**\n\nبوت لمشاهدة المحتوى.\n🔍 أرسل رقم المحتوى للبحث.', token);
  } else if (cmd === 'search') {
    await sendMessage(chatId, '🔍 **أرسل رقم المحتوى:**', token);
  } else {
    await sendMessage(chatId, '🔹 تم تنفيذ الأمر /' + cmd, token);
  }
}

async function handleUserAction(chatId, action, token) {
  if (action === 'about') {
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
  
  if (data === 'cmd_edit') {
    adminState.action = 'cmd_edit';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتعديل:**', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
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
  
  if (data === 'cmd_delete') {
    adminState.action = 'cmd_delete';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = [];
    if (botData.commands.list) {
      botData.commands.list.forEach(c => all.push(c.command));
    }
    const custom = Object.keys(botData.commands.custom || {});
    custom.forEach(c => all.push(c));
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للحذف:**\n\nالمتاحة:\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (data === 'cmd_toggle') {
    adminState.action = 'cmd_toggle';
    adminState.step = 'cmd';
    adminState.temp = { chatId: chatId, msgId: msgId };
    const all = [];
    if (botData.commands.list) {
      botData.commands.list.forEach(c => all.push(c.command));
    }
    const custom = Object.keys(botData.commands.custom || {});
    custom.forEach(c => all.push(c));
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتفعيل/التعطيل:**\n\nالمتاحة:\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  // إدارة المحتوى
  if (data === 'admin_content') {
    await sendMessage(chatId, '📦 **إدارة المحتوى**\n\n🔹 قيد التطوير...', token);
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
        await sendMessage(chatId, '📝 **أدخل الإجراء للزر:**\n(مثل: about, search, help)', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      if (adminState.action === 'add_btn' && adminState.step === 'action') {
        if (!botData.welcome.buttons) {
          botData.welcome.buttons = [];
        }
        botData.welcome.buttons.push({ text: adminState.temp.btnText, action: text });
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
        if (!botData.commands.custom) {
          botData.commands.custom = {};
        }
        botData.commands.custom[adminState.temp.cmd] = { description: text, enabled: true };
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
        let found = null;
        if (botData.commands.list) {
          found = botData.commands.list.find(c => c.command === cmd);
        }
        if (!found && botData.commands.custom && botData.commands.custom[cmd]) {
          found = { command: cmd, ...botData.commands.custom[cmd] };
        }
        if (found) {
          adminState.temp.editCmd = cmd;
          adminState.step = 'desc';
          await sendMessage(chatId, '📝 **أدخل الوصف الجديد لـ /' + cmd + ':**\n\nالحالي: ' + found.description, token, {
            reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
          });
        } else {
          await sendMessage(chatId, '❌ الأمر /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      if (adminState.action === 'cmd_edit' && adminState.step === 'desc') {
        const cmd = adminState.temp.editCmd;
        let found = null;
        if (botData.commands.list) {
          found = botData.commands.list.find(c => c.command === cmd);
        }
        if (found) {
          found.description = text;
        } else if (botData.commands.custom && botData.commands.custom[cmd]) {
          botData.commands.custom[cmd].description = text;
        }
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = commandsSettingsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث وصف /' + cmd, token);
        return;
      }
      
      if (adminState.action === 'cmd_delete' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        if (botData.commands.custom && botData.commands.custom[cmd]) {
          delete botData.commands.custom[cmd];
          await saveData(env);
          adminState.action = null;
          adminState.step = null;
          const menu = commandsSettingsMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم حذف /' + cmd, token);
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود أو لا يمكن حذفه', token);
        }
        return;
      }
      
      if (adminState.action === 'cmd_toggle' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        let found = false;
        if (botData.commands.list) {
          const builtin = botData.commands.list.find(c => c.command === cmd);
          if (builtin) {
            builtin.enabled = !builtin.enabled;
            found = true;
          }
        }
        if (!found && botData.commands.custom && botData.commands.custom[cmd]) {
          botData.commands.custom[cmd].enabled = !botData.commands.custom[cmd].enabled;
          found = true;
        }
        if (found) {
          await saveData(env);
          adminState.action = null;
          adminState.step = null;
          const menu = commandsSettingsMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم التفعيل/التعطيل', token);
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
    
    // الأوامر
    const cmd = text.startsWith('/') ? text.substring(1) : null;
    if (cmd) {
      let found = false;
      if (botData.commands.list) {
        const builtin = botData.commands.list.find(c => c.command === cmd && c.enabled);
        if (builtin) {
          found = true;
          await handleCommand(chatId, cmd, token);
          return;
        }
      }
      if (botData.commands.custom && botData.commands.custom[cmd] && botData.commands.custom[cmd].enabled) {
        found = true;
        await sendMessage(chatId, botData.commands.custom[cmd].description || '🔹 /' + cmd, token);
        return;
      }
      if (!found) {
        await sendMessage(chatId, '❌ الأمر /' + cmd + ' غير معروف', token);
      }
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
