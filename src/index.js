// ====================================================================
// ========== بوت تيليجرام ==========
// ====================================================================

let data = {
  welcome: {
    text: '🎉 مرحباً بك في البوت!\n\nاختر ما تريد:',
    buttons: []
  },
  commands: {}
};

const adminState = { action: null, step: null, temp: {} };
const KV_KEYS = {
  WELCOME: 'bot_welcome',
  COMMANDS: 'bot_commands'
};

// ====================================================================
// ========== دوال KV ==========
// ====================================================================

async function loadData(env) {
  try {
    const welcome = await env.KV_NAMESPACE.get(KV_KEYS.WELCOME, 'json');
    if (welcome) data.welcome = welcome;
    
    const commands = await env.KV_NAMESPACE.get(KV_KEYS.COMMANDS, 'json');
    if (commands) data.commands = commands;
    
    console.log('✅ Data loaded');
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

async function saveData(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.WELCOME, JSON.stringify(data.welcome));
    await env.KV_NAMESPACE.put(KV_KEYS.COMMANDS, JSON.stringify(data.commands));
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

// ====================================================================
// ========== قوائم الأدمن ==========
// ====================================================================

function adminMenu() {
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

function welcomeMenu() {
  const w = data.welcome;
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
        [{ text: '📋 معاينة', callback_data: 'welcome_preview' }],
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

function getUserWelcome() {
  const w = data.welcome;
  const buttons = (w.buttons || []).map(b => [{ text: b.text, callback_data: 'w_' + b.action }]);
  return {
    text: w.text,
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
    const cbData = q.data;
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;
    
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
      
      // إضافة زر - الخطوة 1: النص
      if (adminState.action === 'add_btn' && adminState.step === 'text') {
        adminState.temp.btnText = text;
        adminState.step = 'action';
        await sendMessage(chatId, '📝 **أدخل الإجراء للزر:**', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      // إضافة زر - الخطوة 2: الإجراء
      if (adminState.action === 'add_btn' && adminState.step === 'action') {
        if (!data.welcome.buttons) data.welcome.buttons = [];
        data.welcome.buttons.push({ text: adminState.temp.btnText, action: text });
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = welcomeMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم إضافة الزر', token);
        return;
      }
      
      // إضافة أمر - الخطوة 1: الاسم
      if (adminState.action === 'cmd_add' && adminState.step === 'cmd') {
        adminState.temp.cmd = text;
        adminState.step = 'desc';
        await sendMessage(chatId, '📝 **أدخل وصف الأمر:**', token, {
          reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
        });
        return;
      }
      
      // إضافة أمر - الخطوة 2: الوصف
      if (adminState.action === 'cmd_add' && adminState.step === 'desc') {
        if (!data.commands) data.commands = {};
        data.commands[adminState.temp.cmd] = { description: text, enabled: true };
        await saveData(env);
        adminState.action = null;
        adminState.step = null;
        const menu = commandsMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم إضافة الأمر /' + adminState.temp.cmd, token);
        return;
      }
      
      // تعديل أمر - الخطوة 1: الاسم
      if (adminState.action === 'cmd_edit' && adminState.step === 'cmd') {
        const cmd = text.replace('/', '');
        if (data.commands && data.commands[cmd]) {
          adminState.temp.editCmd = cmd;
          adminState.step = 'desc';
          await sendMessage(chatId, '📝 **أدخل الوصف الجديد لـ /' + cmd + ':**\n\nالحالي: ' + data.commands[cmd].description, token, {
            reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
          });
        } else {
          await sendMessage(chatId, '❌ /' + cmd + ' غير موجود', token);
        }
        return;
      }
      
      // تعديل أمر - الخطوة 2: الوصف
      if (adminState.action === 'cmd_edit' && adminState.step === 'desc') {
        const cmd = adminState.temp.editCmd;
        if (data.commands && data.commands[cmd]) {
          data.commands[cmd].description = text;
          await saveData(env);
          adminState.action = null;
          adminState.step = null;
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
    if (text === '/start') {
      const welcome = getUserWelcome();
      await sendMessage(chatId, welcome.text, token, { reply_markup: welcome.keyboard });
      return;
    }
    
    // الأوامر المخصصة
    const cmd = text.startsWith('/') ? text.substring(1) : null;
    if (cmd && data.commands && data.commands[cmd] && data.commands[cmd].enabled) {
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
  if (cbData === 'admin_back') {
    const menu = adminMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
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
    await sendMessage(chatId, '📝 **أدخل نص الترحيب الجديد:**\n\nالحالي:\n' + data.welcome.text, token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (cbData === 'welcome_add_btn') {
    adminState.action = 'add_btn';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 **أدخل نص الزر:**', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
    return;
  }
  
  if (cbData === 'welcome_del_btn') {
    const btns = data.welcome.buttons || [];
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
  
  if (cbData.startsWith('wel_del_')) {
    const idx = parseInt(cbData.replace('wel_del_', ''));
    const btns = data.welcome.buttons || [];
    if (idx >= 0 && idx < btns.length) {
      btns.splice(idx, 1);
      data.welcome.buttons = btns;
      await saveData(env);
    }
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'welcome_preview') {
    const w = data.welcome;
    let preview = '📋 **معاينة رسالة الترحيب**\n\n' + w.text + '\n\n';
    if (w.buttons && w.buttons.length > 0) {
      preview += '🔘 **الأزرار:**\n';
      w.buttons.forEach(b => {
        preview += '• ' + b.text + '\n';
      });
    }
    await sendMessage(chatId, preview, token);
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
    await sendMessage(chatId, '📝 **أدخل اسم الأمر الجديد:**\n(بدون /)', token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
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
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتعديل:**\n\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
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
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للحذف:**\n\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
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
    await sendMessage(chatId, '📝 **أدخل اسم الأمر للتفعيل/التعطيل:**\n\n' + all.map(c => '• /' + c).join('\n'), token, {
      reply_markup: { keyboard: [[{ text: '🔙 إلغاء' }]], resize_keyboard: true }
    });
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
