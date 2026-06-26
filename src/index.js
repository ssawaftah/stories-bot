// ====================================================================
// ========== بوت تيليجرام ==========
// ====================================================================

let data = {
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
  content: {}
};

const adminState = { action: null, step: null, temp: {} };

// ====================================================================
// ========== دوال مساعدة ==========
// ====================================================================

async function sendMessage(chatId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const payload = { 
    chat_id: chatId, 
    text: text, 
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true }
  };
  if (extra) {
    if (extra.reply_markup) {
      payload.reply_markup = extra.reply_markup;
    }
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
    reply_markup: { remove_keyboard: true }
  };
  if (extra) {
    if (extra.reply_markup) {
      payload.reply_markup = extra.reply_markup;
    }
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
    console.error('Send photo error:', e);
    return { ok: false, description: e.message };
  }
}

async function editMessage(chatId, msgId, text, token, extra) {
  const url = 'https://api.telegram.org/bot' + token + '/editMessageText';
  const payload = { chat_id: chatId, message_id: msgId, text: text, parse_mode: 'HTML' };
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

async function getChatInfo(chatId, token) {
  const url = 'https://api.telegram.org/bot' + token + '/getChat';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });
    const result = await res.json();
    if (result.ok && result.result) {
      return {
        name: result.result.title || result.result.username || chatId,
        type: result.result.type
      };
    }
    return null;
  } catch (e) {
    console.error('Error getting chat info:', e);
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
// ========== دوال التسجيل ==========
// ====================================================================

let logChannelId = null;
let logEnabled = false;

function setLogChannel(channelId) {
  logChannelId = channelId;
}

function setLogEnabled(enabled) {
  logEnabled = enabled;
}

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
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: logChannelId, text: message, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('Log error:', e);
  }
}

// ====================================================================
// ========== قوائم الأدمن ==========
// ====================================================================

function adminMenu() {
  return {
    text: '🔹 <b>لوحة التحكم</b>\n\nاختر الإجراء:',
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
  const verChannel = data.verification.channelName || data.verification.channelId || 'غير محدد';
  const protectStatus = data.protection.enabled ? '🔒 الحماية مفعلة' : '🔓 الحماية معطلة';
  const notifStatus = data.notifications.enabled ? '🔔 الإشعارات مفعلة' : '🔕 الإشعارات معطلة';
  const notifChannel = data.notifications.channelName || data.notifications.channelId || 'غير محدد';
  
  return {
    text: '⚙️ <b>الإعدادات</b>\n\n' +
          '🤖 <b>حالة البوت:</b> ' + botStatus + '\n' +
          '✅ <b>التحقق:</b> ' + verStatus + '\n' +
          '📢 <b>قناة التحقق:</b> ' + verChannel + '\n' +
          '🔒 <b>حماية المحتوى:</b> ' + protectStatus + '\n' +
          '🔔 <b>الإشعارات:</b> ' + notifStatus + '\n' +
          '📢 <b>قناة الإشعارات:</b> ' + notifChannel + '\n\n' +
          '🔹 اختر القسم:',
    keyboard: {
      inline_keyboard: [
        [{ text: '🤖 حالة البوت', callback_data: 'settings_bot_toggle' }],
        [{ text: '✅ التحقق من العضوية', callback_data: 'settings_verification' }],
        [{ text: '🔒 حماية المحتوى', callback_data: 'settings_protection' }],
        [{ text: '🔔 الإشعارات', callback_data: 'settings_notifications' }],
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
    text: '🔒 <b>حماية المحتوى</b>\n\n📌 الحالية: ' + status + '\n\nعند التفعيل، سيمنع المستخدمون من حفظ رسائل البوت وتوجيهها.',
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

// ====================================================================
// ========== قوائم رسالة الترحيب ==========
// ====================================================================

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

function getWelcomeForUser(isNewUser, isPending, isVerified, isRejected) {
  const w = data.welcome;
  const buttons = [];
  
  // المستخدم المرفوض
  if (isRejected) {
    return {
      text: '❌ <b>طلبك مرفوض.</b>\n\nإذا كان لديك استفسار، يرجى التواصل مع الإدارة.',
      image: null,
      useHtml: true,
      buttons: null
    };
  }
  
  // المستخدم في انتظار التحقق
  if (isPending) {
    return {
      text: '⏳ <b>طلبك قيد المراجعة.</b>\n\nيرجى الانتظار حتى يتم التحقق من طلبك.',
      image: null,
      useHtml: true,
      buttons: null
    };
  }
  
  // المستخدم المسجل (محقق أو التحقق معطل)
  if (isVerified || !data.verification.enabled) {
    return {
      text: w.registeredMessage || '📦 <b>مرحباً بعودتك!</b>\n\nيمكنك استخدام البوت الآن.',
      image: null,
      useHtml: w.useHtml || true,
      buttons: null
    };
  }
  
  // مستخدم جديد يحتاج للتحقق
  if (isNewUser || (!isVerified && data.verification.enabled)) {
    buttons.push([{ text: '▶️ بدء الاستخدام', callback_data: 'start_use' }]);
  }
  
  return {
    text: w.text,
    image: w.image,
    useHtml: w.useHtml || false,
    buttons: buttons
  };
}

// ====================================================================
// ========== معالج التحديثات الرئيسي ==========
// ====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
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
      const user = data.users[userId] || {};
      await sendLog(userId, user.username, user.name, '▶️ بدء الاستخدام', 'بدأ المستخدم استخدام البوت', token);
      
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
    
    if (userId !== ADMIN && text) {
      await sendLog(userId, username, name, '📩 رسالة', 'أرسل: ' + text, token);
    }
    
    // ===== الأدمن =====
    if (userId === ADMIN) {
      // تعديل نص الترحيب
      if (adminState.action === 'edit_welcome' && adminState.step === 'text') {
        data.welcome.text = text;
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
        adminState.action = null;
        adminState.step = null;
        const menu = welcomeMenu();
        await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
        await sendMessage(chatId, '✅ تم تحديث رسالة المستخدم المسجل', token);
        return;
      }
      
      // معالجة الصورة المرفوعة
      if (adminState.action === 'upload_welcome_image' && adminState.step === 'waiting_image') {
        if (msg.photo) {
          const photo = msg.photo[msg.photo.length - 1];
          data.welcome.image = photo.file_id;
          adminState.action = null;
          adminState.step = null;
          const menu = welcomeMenu();
          await editMessage(adminState.temp.chatId, adminState.temp.msgId, menu.text, token, { reply_markup: menu.keyboard });
          await sendMessage(chatId, '✅ تم إضافة الصورة بنجاح!', token);
        } else {
          await sendMessage(chatId, '❌ يرجى إرسال صورة صالحة.', token);
        }
        return;
      }
      
      // تعديل رسالة الإيقاف
      if (adminState.action === 'edit_stop' && adminState.step === 'text') {
        data.settings.stopMessage = text;
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
          adminState.action = null;
          adminState.step = null;
          
          const testMsg = '✅ <b>تم تعيين هذه القناة للتحقق من العضوية.</b>\n\nستصل طلبات التحقق الجديدة إلى هنا.';
          await sendMessage(channelId, testMsg, token);
          
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
          adminState.action = null;
          adminState.step = null;
          
          const testMsg = '✅ <b>تم تعيين هذه القناة للإشعارات.</b>\n\nستصل جميع إجراءات المستخدمين إلى هنا.';
          await sendMessage(channelId, testMsg, token);
          
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
        if (data.verification.verifiedUsers && data.verification.verifiedUsers[targetId]) {
          delete data.verification.verifiedUsers[targetId];
        }
        if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
          delete data.verification.rejectedUsers[targetId];
        }
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
          
          const result = await sendMessage(data.verification.channelId, adminMsg, token, { reply_markup: kb });
          
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
        
        await sendMessage(chatId, '⏳ تم استلام طلبك! جاري المراجعة...', token);
        return;
      }
    }
    
    // المستخدم - /start
    if (text === '/start') {
      await sendLog(userId, username, name, '🔄 بدء', 'ضغط على /start', token);
      
      const isNewUser = !data.users[userId];
      const isPending = data.verification.pendingUsers && data.verification.pendingUsers[userId];
      const isVerified = data.verification.verifiedUsers && data.verification.verifiedUsers[userId];
      const isRejected = data.verification.rejectedUsers && data.verification.rejectedUsers[userId];
      
      if (isNewUser) {
        data.users[userId] = { name: name, username: username, joined: new Date().toISOString() };
      }
      
      const welcome = getWelcomeForUser(isNewUser, isPending, isVerified, isRejected);
      
      // إرسال الرسالة مع الصورة إذا كانت موجودة
      if (welcome.image) {
        await sendPhoto(chatId, welcome.image, welcome.text, token, { 
          reply_markup: welcome.buttons ? { inline_keyboard: welcome.buttons } : { remove_keyboard: true },
          parse_mode: 'HTML'
        });
      } else {
        await sendMessage(chatId, welcome.text, token, { 
          reply_markup: welcome.buttons ? { inline_keyboard: welcome.buttons } : { remove_keyboard: true },
          parse_mode: 'HTML'
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
    const menu = botSettingsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'bot_edit_stop') {
    adminState.action = 'edit_stop';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 <b>أدخل رسالة الإيقاف الجديدة:</b>\n\nالحالية:\n' + data.settings.stopMessage, token);
    return;
  }
  
  // ===== التحقق =====
  if (cbData === 'settings_verification') {
    const menu = verificationMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'verif_toggle') {
    data.verification.enabled = !data.verification.enabled;
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
    await sendMessage(chatId, '📝 <b>أدخل نص طلب الرقم الجديد:</b>\n\nالحالي:\n' + data.verification.requestMessage, token);
    return;
  }
  
  if (cbData === 'verif_msg_button') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'buttonText' };
    await sendMessage(chatId, '📝 <b>أدخل نص زر المشاركة الجديد:</b>\n\nالحالي:\n' + data.verification.buttonText, token);
    return;
  }
  
  if (cbData === 'verif_msg_success') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'successMessage' };
    await sendMessage(chatId, '📝 <b>أدخل رسالة النجاح الجديدة:</b>\n\nالحالية:\n' + data.verification.successMessage, token);
    return;
  }
  
  if (cbData === 'verif_msg_fail') {
    adminState.action = 'edit_verif_msg';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId, field: 'failMessage' };
    await sendMessage(chatId, '📝 <b>أدخل رسالة الرفض الجديدة:</b>\n\nالحالية:\n' + data.verification.failMessage, token);
    return;
  }
  
  if (cbData === 'verif_channel') {
    adminState.action = 'set_verif_channel';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
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
    let text = '❌ <b>المستخدمين المرفوضين</b>\n\n';
    
    if (keys.length === 0) {
      text += 'لا يوجد مستخدمين مرفوضين.';
      await sendMessage(chatId, text, token);
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
    
    await editMessage(chatId, msgId, text, token, { 
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }
  
  if (cbData.startsWith('verif_reapprove_')) {
    const targetId = cbData.replace('verif_reapprove_', '');
    
    if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
      const user = data.verification.rejectedUsers[targetId];
      
      if (!data.verification.verifiedUsers) data.verification.verifiedUsers = {};
      data.verification.verifiedUsers[targetId] = { 
        name: user.name, 
        date: new Date().toISOString(),
        reapproved: true 
      };
      delete data.verification.rejectedUsers[targetId];
      
      await sendMessage(targetId, '✅ <b>تم إعادة قبول طلبك!</b>\n\n' + data.verification.successMessage, token);
      await sendMessage(targetId, '📦 <b>المحتوى:</b>\n\nمرحباً! يمكنك الآن استخدام البوت.', token);
      
      const v = data.verification.rejectedUsers || {};
      const keys = Object.keys(v);
      let text = '❌ <b>المستخدمين المرفوضين</b>\n\n';
      
      if (keys.length === 0) {
        text += 'لا يوجد مستخدمين مرفوضين.';
        await editMessage(chatId, msgId, text, token);
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
      
      await editMessage(chatId, msgId, text, token, { 
        reply_markup: { inline_keyboard: buttons }
      });
      await sendMessage(chatId, '✅ <b>تم إعادة قبول المستخدم ' + targetId + '</b>', token);
    }
    return;
  }
  
  if (cbData.startsWith('verif_delete_rejected_')) {
    const targetId = cbData.replace('verif_delete_rejected_', '');
    
    if (data.verification.rejectedUsers && data.verification.rejectedUsers[targetId]) {
      delete data.verification.rejectedUsers[targetId];
      
      const v = data.verification.rejectedUsers || {};
      const keys = Object.keys(v);
      let text = '❌ <b>المستخدمين المرفوضين</b>\n\n';
      
      if (keys.length === 0) {
        text += 'لا يوجد مستخدمين مرفوضين.';
        await editMessage(chatId, msgId, text, token);
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
      
      await editMessage(chatId, msgId, text, token, { 
        reply_markup: { inline_keyboard: buttons }
      });
      await sendMessage(chatId, '🗑️ <b>تم حذف المستخدم ' + targetId + ' من المرفوضين</b>', token);
    }
    return;
  }
  
  if (cbData === 'verif_add_user') {
    adminState.action = 'verif_add_user';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 <b>أدخل ID المستخدم للإضافة:</b>', token);
    return;
  }
  
  if (cbData === 'verif_remove_user') {
    adminState.action = 'verif_remove_user';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
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
      
      await editMessage(chatId, msgId, '❌ <b>تم رفض المستخدم</b>\n\n' + user.name, token);
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
    const menu = notificationsMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    return;
  }
  
  if (cbData === 'notif_channel') {
    adminState.action = 'set_notif_channel';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '📝 <b>أدخل معرف قناة الإشعارات:</b>\n(يجب أن يكون البوت أدمن في القناة)', token);
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
    await sendMessage(chatId, '📝 <b>أدخل نص الترحيب الجديد:</b>\n(يمكنك استخدام HTML)\n\nالحالي:\n' + data.welcome.text, token);
    return;
  }
  
  if (cbData === 'welcome_edit_image') {
    adminState.action = 'upload_welcome_image';
    adminState.step = 'waiting_image';
    adminState.temp = { chatId: chatId, msgId: msgId };
    await sendMessage(chatId, '🖼️ <b>أرسل الصورة الجديدة:</b>', token);
    return;
  }
  
  if (cbData === 'welcome_delete_image') {
    data.welcome.image = null;
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '🗑️ تم حذف الصورة', token);
    return;
  }
  
  if (cbData === 'welcome_toggle_html') {
    data.welcome.useHtml = !data.welcome.useHtml;
    const menu = welcomeMenu();
    await editMessage(chatId, msgId, menu.text, token, { reply_markup: menu.keyboard });
    await sendMessage(chatId, '📄 تم ' + (data.welcome.useHtml ? 'تفعيل' : 'تعطيل') + ' وضع HTML', token);
    return;
  }
  
  if (cbData === 'welcome_edit_registered') {
    adminState.action = 'edit_registered';
    adminState.step = 'text';
    adminState.temp = { chatId: chatId, msgId: msgId };
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
      await sendPhoto(chatId, w.image, previewText, token);
    } else {
      await sendMessage(chatId, previewText, token);
    }
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
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر الجديد:</b>\n(بدون /)', token);
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
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للتعديل:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
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
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للحذف:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
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
    await sendMessage(chatId, '📝 <b>أدخل اسم الأمر للتفعيل/التعطيل:</b>\n\n' + all.map(c => '• /' + c).join('\n'), token);
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
