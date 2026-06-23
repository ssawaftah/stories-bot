// ========== التخزين المؤقت (للذاكرة) ==========
let pendingUsers = {};
let rejectedUsers = {};
let approvedUsers = {};
let contentSystem = { items: {} };
let mandatorySubscription = { channels: [], groups: [], enabled: false };
let botSettings = { 
  aboutText: '📌 بوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته', 
  logChannel: 'ineswangelogs'  // سيتم تحديثه من env
};
let textSystem = {};

// ========== حالة الأدمن ==========
const adminState = {
  currentAction: null,
  step: null,
  tempData: {}
};

// ========== حالة المستخدم ==========
const userState = {};

// ========== أسماء مفاتيح KV ==========
const KV_KEYS = {
  USERS: 'bot_users',
  CONTENT: 'bot_content',
  SUBSCRIPTION: 'bot_subscription',
  SETTINGS: 'bot_settings',
  TEXTS: 'bot_texts'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // تحديث إعدادات البوت من البيئة
    botSettings.logChannel = env.LOG_CHANNEL_ID || 'ineswangelogs';
    console.log('📢 قناة التسجيل:', botSettings.logChannel);
    
    // ===== تحميل البيانات من KV عند بدء التشغيل =====
    await loadDataFromKV(env);
    
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
// ========== دوال KV ==========
// ====================================================================

async function loadDataFromKV(env) {
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

    // تحميل النصوص
    const textsData = await env.KV_NAMESPACE.get(KV_KEYS.TEXTS, 'json');
    if (textsData) {
      textSystem = textsData;
    } else {
      textSystem = getDefaultTexts();
      await env.KV_NAMESPACE.put(KV_KEYS.TEXTS, JSON.stringify(textSystem));
    }

    console.log('✅ Data loaded from KV successfully');
  } catch (error) {
    console.error('Error loading data from KV:', error);
    textSystem = getDefaultTexts();
  }
}

async function saveUsersToKV(env) {
  try {
    const data = { pending: pendingUsers, rejected: rejectedUsers, approved: approvedUsers };
    await env.KV_NAMESPACE.put(KV_KEYS.USERS, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving users to KV:', error);
  }
}

async function saveContentToKV(env) {
  try {
    const data = { items: contentSystem.items };
    await env.KV_NAMESPACE.put(KV_KEYS.CONTENT, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving content to KV:', error);
  }
}

async function saveSubscriptionToKV(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.SUBSCRIPTION, JSON.stringify(mandatorySubscription));
  } catch (error) {
    console.error('Error saving subscription to KV:', error);
  }
}

async function saveSettingsToKV(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.SETTINGS, JSON.stringify(botSettings));
  } catch (error) {
    console.error('Error saving settings to KV:', error);
  }
}

async function saveTextsToKV(env) {
  try {
    await env.KV_NAMESPACE.put(KV_KEYS.TEXTS, JSON.stringify(textSystem));
  } catch (error) {
    console.error('Error saving texts to KV:', error);
  }
}

async function saveAllDataToKV(env) {
  await saveUsersToKV(env);
  await saveContentToKV(env);
  await saveSubscriptionToKV(env);
  await saveSettingsToKV(env);
  await saveTextsToKV(env);
}

// ====================================================================
// ========== النصوص الافتراضية ==========
// ====================================================================

function getDefaultTexts() {
  return {
    user: {
      welcome: '🎉 مرحباً بك في البوت!\n\n🔍 ابحث عن محتوى عبر إرسال رقم المحتوى.\n📌 أو استخدم الأزرار أدناه:',
      search_prompt: 'أرسل رقم المحتوى الذي تريد مشاهدته:',
      about: '📌 بوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته',
      no_content: '❌ لا يوجد محتوى برقم {contentId}\n\nتأكد من الرقم وحاول مرة أخرى:',
      no_content_search: '❌ لا يوجد محتوى برقم {contentId}\n\n🔍 استخدم زر "البحث عن محتوى"',
      choose_action: 'اختر الإجراء:',
      back_to_menu: '🔙 رجوع',
      search_button: '🔍 البحث عن محتوى',
      about_button: 'ℹ️ عن البوت',
      subscription_required: '🔐 للوصول إلى محتوى البوت، يجب عليك الاشتراك في القنوات التالية:\n\n{channels}\n\n✅ بعد الاشتراك، اضغط /start مرة أخرى.',
      not_approved: '🔐 يجب الموافقة على طلبك أولاً.\nاضغط /start',
      request_received: '⏳ تم استلام طلبك! جاري التحقق...',
      request_pending: '⏳ طلبك قيد المراجعة...',
      request_verified: '🔐 يرجى مشاركة رقم هاتفك أولاً.\nاضغط /start',
      share_phone: '🔐 للتحقق، شارك رقم هاتفك:',
      share_phone_button: '📱 مشاركة الرقم',
      approved: '✅ تمت الموافقة! اضغط /start',
      rejected: '❌ طلبك مرفوض. للتواصل: @jahab',
      reapproved: '✅ تم استئناف طلبك! اضغط /start',
      video_error: '⚠️ حدث خطأ في عرض الفيديو',
      photo_error: '⚠️ حدث خطأ في عرض الصورة',
      document_error: '⚠️ حدث خطأ في عرض الملف'
    },
    admin: {
      welcome: '👋 مرحباً بك في لوحة التحكم\n\n📊 الإحصائيات:\n• 📋 طلبات جديدة: {pending}\n• 📦 محتوى: {content}\n• 🔗 اشتراكات إجبارية: {subscription}\n\n📌 اختر الإدارة المناسبة:',
      add_content_title: '➕ إضافة محتوى جديد\n\nاختر نوع المحتوى:',
      add_content_prompt: 'أدخل عنوان المحتوى (نوع: {type}):',
      add_content_instruction: '{instruction}\n\n(اضغط "حفظ" عند الانتهاء)',
      add_content_success: '✅ تم إضافة {type}\nأرسل المزيد أو اضغط "حفظ المحتوى":',
      content_saved: '✅ تم حفظ المحتوى بنجاح!\n\nالعنوان: {title}\nالنوع: {type}\nالرقم: {contentId}\nعدد العناصر: {count}\n\nرابط المشاركة:\n{shareLink}',
      no_text: '⚠️ لم يتم إضافة أي نص!',
      no_media: '⚠️ لم يتم إضافة أي وسائط!',
      text_added: '✅ تم إضافة النص\nأرسل النص التالي أو اضغط "حفظ المحتوى":',
      content_management: '📦 إدارة المحتوى\n\n📊 الإحصائيات:\n• 📦 مجموع المحتويات: {total}\n\n🔸 الإجراءات:\n• 📦 عرض الكل\n• ✏️ تعديل محتوى\n• 🗑️ حذف محتوى',
      no_content_list: '📦 لا يوجد محتوى',
      content_list: '📦 قائمة المحتويات:\n\n',
      no_content_delete: '📦 لا يوجد محتوى للحذف',
      delete_prompt: '🗑️ اختر المحتوى للحذف:',
      no_content_edit: '📦 لا يوجد محتوى للتعديل',
      edit_prompt: '✏️ اختر المحتوى للتعديل:',
      edit_title_prompt: '✏️ تعديل المحتوى رقم {id}\nالعنوان الحالي: {title}\n\nأدخل العنوان الجديد:',
      edit_content_prompt: 'أدخل المحتوى الجديد:',
      content_edited: '✅ تم تعديل المحتوى رقم {id}',
      content_deleted: '✅ تم حذف المحتوى رقم {id}',
      content_not_found: '⚠️ المحتوى رقم {id} غير موجود',
      subscription_management: '🔗 إدارة الاشتراك الإجباري\n\n📊 الحالة: {status}\n\n📢 القنوات:\n• {channels}\n\n👥 المجموعات:\n• {groups}\n\nاختر الإجراء:',
      add_channel_prompt: 'أدخل معرف القناة (مثل: @channel أو -100123456):',
      add_group_prompt: 'أدخل معرف المجموعة (مثل: -100123456):',
      channel_added: '✅ تم إضافة القناة {id}',
      channel_exists: '⚠️ القناة {id} موجودة بالفعل',
      group_added: '✅ تم إضافة المجموعة {id}',
      group_exists: '⚠️ المجموعة {id} موجودة بالفعل',
      subscription_toggled: '✅ تم {status} الاشتراك الإجباري',
      no_subscriptions: '⚠️ لا يوجد اشتراكات للحذف',
      delete_sub_prompt: '🗑️ اختر الاشتراك للحذف:',
      sub_deleted: '✅ تم حذف {type} {id}',
      bot_settings: '⚙️ إعدادات البوت\n\n📝 نص "عن البوت":\n{about}\n\n📢 قناة التسجيل: {logChannel}\n\nالإجراءات:',
      edit_about_prompt: 'أدخل النص الجديد لـ "عن البوت":\n\nالنص الحالي:\n{about}',
      about_updated: '✅ تم تحديث نص "عن البوت"',
      statistics: '📊 الإحصائيات العامة:\n\n👥 المستخدمين:\n• ✅ معتمدين: {approved}\n• ⏳ معلق: {pending}\n• ❌ مرفوض: {rejected}\n\n📦 المحتوى:\n• 📦 مجموع: {total}\n• 🖼️ صور: {images}\n• 🎬 فيديو: {videos}\n• 📝 نصوص: {texts}\n\n🔗 الاشتراك الإجباري:\n• 📢 قنوات: {channels}\n• 👥 مجموعات: {groups}\n• 📌 الحالة: {subStatus}\n\n📢 قناة التسجيل: {logChannel}\n\n⏱️ آخر تحديث: {time}',
      back: '🔙 العودة',
      cancel: '🔙 إلغاء',
      unknown: '⚠️ خيار غير معروف. استخدم الأزرار.',
      requests_management: '📋 إدارة الطلبات\n\n📌 المعلقة: {pending}\n❌ المرفوضة: {rejected}\n\nاختر القائمة:',
      pending_list: '📋 الطلبات المعلقة:\n\n',
      rejected_list: '❌ المرفوضين:\n\n',
      approved_list: '✅ المعتمدين:\n\n',
      no_pending: '📋 لا توجد طلبات معلقة',
      no_rejected: '❌ لا يوجد مرفوضين',
      no_approved: '✅ لا يوجد معتمدين',
      approved_user: '✅ تم القبول',
      rejected_user: '❌ تم الرفض',
      reapproved_user: '✅ تم إعادة الموافقة',
      user_details: '📋 تفاصيل المستخدم:\n👤 الاسم: {name}\n🆔 اليوزرنيم: @{username}\n📱 رقم الهاتف: {phone}\n🕐 تاريخ الطلب: {time}\n📌 الحالة: {status}',
      user_deleted: '🗑️ تم حذف المستخدم',
      text_management: '📝 إدارة النصوص\n\nاختر القسم:',
      user_texts: '👤 نصوص المستخدم',
      admin_texts: '👤 نصوص الأدمن',
      text_list: '📋 قائمة النصوص:\n\n',
      select_text: '✏️ اختر النص لتعديله:',
      edit_text_prompt: '✏️ تعديل النص: {key}\n\nالنص الحالي:\n{current}\n\nأدخل النص الجديد:',
      text_updated: '✅ تم تحديث النص: {key}',
      text_not_found: '⚠️ النص غير موجود',
      no_texts: '📋 لا توجد نصوص',
      export_import: '🔄 تصدير/استيراد البيانات\n\n📤 تصدير: حفظ جميع البيانات (مستخدمين، محتوى، إعدادات، نصوص)\n📥 استيراد: استعادة البيانات من نسخة محفوظة',
      export_success: '✅ تم تصدير البيانات بنجاح!\n\nعدد المستخدمين: {users}\nعدد المحتويات: {content}\nعدد النصوص: {texts}\n\n📌 انسخ البيانات أدناه للاستيراد لاحقاً:',
      import_prompt: '📥 أرسل بيانات JSON للاستيراد:',
      import_success: '✅ تم استيراد البيانات بنجاح!\n\nعدد المستخدمين: {users}\nعدد المحتويات: {content}\nعدد النصوص: {texts}',
      import_error: '⚠️ فشل استيراد البيانات. تأكد من صحة التنسيق.',
      export_button: '📤 تصدير البيانات',
      import_button: '📥 استيراد البيانات'
    }
  };
}

// ====================================================================
// ========== دوال النصوص ==========
// ====================================================================

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

function getAdminText(key, replacements = {}) {
  return getText('admin', key, replacements);
}

// ====================================================================
// ========== دوال التسجيل (قناة الأحداث) - مُحسّنة ==========
// ====================================================================

async function sendLog(message, token) {
  const logChannel = botSettings.logChannel;
  if (!logChannel) {
    console.log('⚠️ لا توجد قناة تسجيل محددة');
    return;
  }
  
  console.log(`📤 محاولة إرسال سجل إلى: ${logChannel}`);
  
  try {
    const result = await sendMessage(logChannel, message, token);
    if (result && result.ok) {
      console.log('✅ تم إرسال السجل بنجاح');
    } else {
      console.log('❌ فشل إرسال السجل:', result);
      // محاولة بديلة
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload = {
          chat_id: logChannel,
          text: message
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('محاولة بديلة:', data);
      } catch (e) {
        console.error('فشل المحاولة البديلة:', e);
      }
    }
  } catch (error) {
    console.error('❌ خطأ في إرسال السجل:', error);
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

  console.log('📝 تسجيل إجراء:', action, 'للمستخدم:', userId);
  await sendLog(logMessage, token);
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
    texts: textSystem
  };

  const jsonData = JSON.stringify(exportData, null, 2);
  
  if (jsonData.length > 4000) {
    const parts = jsonData.match(/[\s\S]{1,4000}/g) || [];
    await sendMessage(chatId, getAdminText('export_success', {
      users: Object.keys(approvedUsers).length + Object.keys(pendingUsers).length + Object.keys(rejectedUsers).length,
      content: Object.keys(contentSystem.items).length,
      texts: Object.keys(textSystem.user).length + Object.keys(textSystem.admin).length
    }), token);
    
    for (let i = 0; i < parts.length; i++) {
      await sendMessage(chatId, `📄 الجزء ${i + 1}/${parts.length}:\n\n<pre>${parts[i]}</pre>`, token, { parse_mode: 'HTML' });
    }
  } else {
    await sendMessage(chatId, getAdminText('export_success', {
      users: Object.keys(approvedUsers).length + Object.keys(pendingUsers).length + Object.keys(rejectedUsers).length,
      content: Object.keys(contentSystem.items).length,
      texts: Object.keys(textSystem.user).length + Object.keys(textSystem.admin).length
    }) + `\n\n<pre>${jsonData}</pre>`, token, { parse_mode: 'HTML' });
  }
}

async function importAllData(chatId, text, token, env) {
  try {
    const data = JSON.parse(text);
    
    if (!data.users || !data.content || !data.subscription || !data.settings || !data.texts) {
      throw new Error('بيانات غير مكتملة');
    }

    pendingUsers = data.users.pending || {};
    rejectedUsers = data.users.rejected || {};
    approvedUsers = data.users.approved || {};
    await saveUsersToKV(env);

    contentSystem.items = data.content || {};
    await saveContentToKV(env);

    mandatorySubscription = data.subscription || { channels: [], groups: [], enabled: false };
    await saveSubscriptionToKV(env);

    botSettings = data.settings || botSettings;
    await saveSettingsToKV(env);

    textSystem = data.texts || getDefaultTexts();
    await saveTextsToKV(env);

    await sendMessage(chatId, getAdminText('import_success', {
      users: Object.keys(approvedUsers).length + Object.keys(pendingUsers).length + Object.keys(rejectedUsers).length,
      content: Object.keys(contentSystem.items).length,
      texts: Object.keys(textSystem.user).length + Object.keys(textSystem.admin).length
    }), token);
    
    await showAdminMainMenu(chatId, token);
  } catch (error) {
    console.error('Import error:', error);
    await sendMessage(chatId, getAdminText('import_error'), token);
  }
}

// ====================================================================
// ========== نظام الاشتراك الإجباري ==========
// ====================================================================

async function checkMandatorySubscription(userId, token) {
  if (!mandatorySubscription.enabled) return true;
  
  try {
    for (const channel of mandatorySubscription.channels) {
      const chatMember = await getChatMember(channel, userId, token);
      if (!chatMember || chatMember.status === 'left' || chatMember.status === 'kicked') {
        return false;
      }
    }
    
    for (const group of mandatorySubscription.groups) {
      const chatMember = await getChatMember(group, userId, token);
      if (!chatMember || chatMember.status === 'left' || chatMember.status === 'kicked') {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return true;
  }
}

async function getChatMember(chatId, userId, token) {
  const url = `https://api.telegram.org/bot${token}/getChatMember`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId })
    });
    const data = await response.json();
    return data.result;
  } catch (error) {
    return null;
  }
}

async function sendSubscriptionMessage(chatId, token) {
  const channelsList = mandatorySubscription.channels.map(c => `• ${c}`).join('\n');
  const groupsList = mandatorySubscription.groups.map(g => `• ${g}`).join('\n');
  const allSubs = [channelsList, groupsList].filter(s => s).join('\n');
  
  const message = getUserText('subscription_required', { channels: allSubs || 'لا يوجد' });
  await sendMessage(chatId, message, token);
}

// ====================================================================
// ========== معالجة التحديثات ==========
// ====================================================================

async function handleTelegramUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN_ID = env.ADMIN_ID;

  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;

      // ========== واجهة الأدمن ==========
      if (userId.toString() === ADMIN_ID) {
        if (msg.video || msg.animation || msg.document || msg.photo) {
          await handleAdminMedia(chatId, msg, token);
          return;
        }

        if (text === '/start' || text === '/admin') {
          await showAdminMainMenu(chatId, token);
          return;
        }
        await handleAdminActions(chatId, text, token, env);
        return;
      }

      // ========== واجهة المستخدم ==========
      if (rejectedUsers[userId]) {
        await sendMessage(chatId, getUserText('rejected'), token, {
          reply_markup: { remove_keyboard: true }
        });
        return;
      }

      if (text && text.startsWith('/start share_')) {
        const contentId = text.replace('/start share_', '').trim();
        
        if (!approvedUsers[userId]) {
          await sendMessage(chatId, getUserText('not_approved'), token);
          return;
        }

        const subscribed = await checkMandatorySubscription(userId, token);
        if (!subscribed) {
          await sendSubscriptionMessage(chatId, token);
          return;
        }

        const item = contentSystem.items[contentId];
        if (item) {
          userState[userId] = { step: 'main' };
          await sendContent(chatId, item, token);
        } else {
          await sendMessage(chatId, getUserText('no_content', { contentId }), token);
          await showUserMainMenu(chatId, token);
        }
        return;
      }

      if (text === '/start') {
        if (approvedUsers[userId]) {
          const subscribed = await checkMandatorySubscription(userId, token);
          if (!subscribed) {
            await sendSubscriptionMessage(chatId, token);
            return;
          }
          
          userState[userId] = { step: 'main' };
          await showUserMainMenu(chatId, token);
          return;
        }

        if (pendingUsers[userId]) {
          await sendMessage(chatId, getUserText('request_pending'), token, {
            reply_markup: { remove_keyboard: true }
          });
          return;
        }

        await sendMessage(chatId, getUserText('share_phone'), token, {
          reply_markup: {
            keyboard: [[{ text: getUserText('share_phone_button'), request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        return;
      }

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
        await saveUsersToKV(env);

        await sendMessage(chatId, getUserText('request_received'), token, {
          reply_markup: { remove_keyboard: true }
        });

        const adminMsg = `📢 طلب انضمام جديد!\n👤 ${userData.name}\n🆔 @${userData.username}\n📱 ${userData.phone}`;
        await sendMessage(ADMIN_ID, adminMsg, token);
        
        await logUserAction(userId, userData.username, '📋 طلب انضمام', `الاسم: ${userData.name}`, token);
        return;
      }

      if (!approvedUsers[userId]) {
        await sendMessage(chatId, getUserText('request_verified'), token);
        return;
      }

      const subscribed = await checkMandatorySubscription(userId, token);
      if (!subscribed) {
        await sendSubscriptionMessage(chatId, token);
        return;
      }

      await handleUserSearch(chatId, text, token, userId);
      return;
    }

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
    }
  } catch (error) {
    console.error('Error in handleTelegramUpdate:', error);
  }
}

// ====================================================================
// ========== دوال الأدمن ==========
// ====================================================================

async function showAdminMainMenu(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const contentCount = Object.keys(contentSystem.items).length;
  const subscriptionCount = mandatorySubscription.channels.length + mandatorySubscription.groups.length;

  const message = getAdminText('welcome', {
    pending: pendingCount,
    content: contentCount,
    subscription: subscriptionCount
  });

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['➕ إضافة محتوى', '📋 إدارة الطلبات'],
        ['📦 إدارة المحتوى', '🔗 الاشتراك الإجباري'],
        ['📝 إدارة النصوص', '⚙️ إعدادات البوت'],
        ['🔄 تصدير/استيراد', '📊 الإحصائيات'],
        ['📢 اختبار القناة', getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminActions(chatId, text, token, env) {
  // ===== اختبار قناة الأحداث =====
  if (text === '📢 اختبار القناة') {
    await sendLog('🧪 هذا اختبار لقناة الأحداث! 🧪\n\n✅ إذا رأيت هذه الرسالة، فإن القناة تعمل بشكل صحيح.', token);
    await sendMessage(chatId, '✅ تم إرسال اختبار إلى قناة الأحداث', token);
    return;
  }

  // ===== معالجة نصوص المستخدم والأدمن =====
  if (text === '👤 نصوص المستخدم') {
    await showTextList(chatId, 'user', token);
    return;
  }

  if (text === '👤 نصوص الأدمن') {
    await showTextList(chatId, 'admin', token);
    return;
  }

  switch(text) {
    case '➕ إضافة محتوى':
      await showAddContentMenu(chatId, token);
      break;
      
    case '📋 إدارة الطلبات':
      await showRequestsManagement(chatId, token);
      break;
      
    case '📦 إدارة المحتوى':
      await showContentManagement(chatId, token);
      break;
      
    case '🔗 الاشتراك الإجباري':
      await showSubscriptionManagement(chatId, token);
      break;
      
    case '📝 إدارة النصوص':
      await showTextManagement(chatId, token);
      break;
      
    case '⚙️ إعدادات البوت':
      await showBotSettings(chatId, token);
      break;
      
    case '🔄 تصدير/استيراد':
      await showExportImport(chatId, token);
      break;
      
    case '📊 الإحصائيات':
      await showStatistics(chatId, token);
      break;
      
    case getAdminText('back'):
    case 'رجوع':
    case '🔙 إلغاء':
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showAdminMainMenu(chatId, token);
      break;
      
    default:
      await handleAdminSubActions(chatId, text, token, env);
      break;
  }
}

// ====================================================================
// ========== تصدير/استيراد ==========
// ====================================================================

async function showExportImport(chatId, token) {
  const message = getAdminText('export_import');

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📤 تصدير البيانات', '📥 استيراد البيانات'],
        [getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

// ====================================================================
// ========== إدارة النصوص ==========
// ====================================================================

async function showTextManagement(chatId, token) {
  const message = getAdminText('text_management');

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['👤 نصوص المستخدم', '👤 نصوص الأدمن'],
        [getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

async function showTextList(chatId, category, token) {
  const texts = textSystem[category];
  if (!texts) {
    await sendMessage(chatId, getAdminText('no_texts'), token);
    return;
  }

  let message = getAdminText('text_list');
  const buttons = [];
  
  let count = 0;
  for (const [key, value] of Object.entries(texts)) {
    if (count >= 20) {
      message += `\n... و${Object.keys(texts).length - count} نصوص أخرى`;
      break;
    }
    const shortValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
    message += `• ${key}: ${shortValue}\n`;
    buttons.push([{ text: `✏️ ${key}`, callback_data: `edit_text_${category}_${key}` }]);
    count++;
  }
  
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleEditText(chatId, category, key, token) {
  const currentText = textSystem[category]?.[key];
  if (!currentText) {
    await sendMessage(chatId, getAdminText('text_not_found'), token);
    return;
  }

  adminState.currentAction = 'edit_text';
  adminState.step = 'waiting_text';
  adminState.tempData = { category, key };

  const message = getAdminText('edit_text_prompt', {
    key: key,
    current: currentText
  });

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [[getAdminText('cancel')]],
      resize_keyboard: true
    }
  });
}

async function saveEditedText(chatId, text, token, env) {
  const { category, key } = adminState.tempData;
  
  if (textSystem[category]) {
    textSystem[category][key] = text;
    await saveTextsToKV(env);
  }

  await sendMessage(chatId, getAdminText('text_updated', { key }), token);
  
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showTextManagement(chatId, token);
}

// ====================================================================
// ========== إضافة محتوى ==========
// ====================================================================

async function showAddContentMenu(chatId, token) {
  const message = getAdminText('add_content_title');

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['🖼️ صورة', '🎬 فيديو', '📝 نص'],
        [getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminSubActions(chatId, text, token, env) {
  // ===== اختيار نوع المحتوى =====
  if (text === '🖼️ صورة' || text === '🎬 فيديو' || text === '📝 نص') {
    const typeMap = {
      '🖼️ صورة': 'image',
      '🎬 فيديو': 'video',
      '📝 نص': 'text'
    };
    
    adminState.currentAction = 'add_content';
    adminState.step = 'waiting_title';
    adminState.tempData.type = typeMap[text];
    adminState.tempData.mediaItems = [];
    
    await sendMessage(chatId, 
      getAdminText('add_content_prompt', { type: text }),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== معالجة عنوان المحتوى =====
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_title') {
    adminState.tempData.title = text;
    adminState.step = 'waiting_content';
    
    const type = adminState.tempData.type;
    let instruction = '';
    if (type === 'image') instruction = 'أرسل الصور (يمكنك إرسال عدة صور):';
    else if (type === 'video') instruction = 'أرسل الفيديو:';
    else if (type === 'text') instruction = 'أرسل النص (يمكنك إرسال عدة نصوص):';
    
    await sendMessage(chatId, 
      getAdminText('add_content_instruction', { instruction }),
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ المحتوى'],
            [getAdminText('cancel')]
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== حفظ المحتوى =====
  if (text === '✅ حفظ المحتوى' && adminState.currentAction === 'add_content') {
    await saveSingleContent(chatId, token, env);
    return;
  }

  // ===== إلغاء =====
  if (text === getAdminText('cancel') || text === getAdminText('back')) {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
    return;
  }

  // ===== معالجة النص =====
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content') {
    if (adminState.tempData.type === 'text') {
      if (!adminState.tempData.texts) {
        adminState.tempData.texts = [];
      }
      adminState.tempData.texts.push(text);
      
      await sendMessage(chatId, 
        getAdminText('text_added'),
        token,
        { 
          reply_markup: { 
            keyboard: [
              ['✅ حفظ المحتوى'],
              [getAdminText('cancel')]
            ], 
            resize_keyboard: true 
          }
        }
      );
    }
    return;
  }

  // ===== تعديل المحتوى =====
  if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_new_title') {
    adminState.tempData.newTitle = text;
    adminState.step = 'waiting_new_content';
    
    await sendMessage(chatId, 
      getAdminText('edit_content_prompt'),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_new_content') {
    const contentId = adminState.tempData.contentId;
    const item = contentSystem.items[contentId];
    
    if (item) {
      item.title = adminState.tempData.newTitle;
      item.content = text;
      item.date = new Date().toLocaleString('ar-EG');
      await saveContentToKV(env);
      
      await sendMessage(chatId, getAdminText('content_edited', { id: contentId }), token);
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showContentManagement(chatId, token);
    }
    return;
  }

  // ===== تعديل النصوص =====
  if (adminState.currentAction === 'edit_text' && adminState.step === 'waiting_text') {
    await saveEditedText(chatId, text, token, env);
    return;
  }

  // ===== تصدير البيانات =====
  if (text === '📤 تصدير البيانات') {
    await exportAllData(chatId, token);
    return;
  }

  // ===== استيراد البيانات =====
  if (text === '📥 استيراد البيانات') {
    adminState.currentAction = 'import_data';
    adminState.step = 'waiting_data';
    await sendMessage(chatId, 
      getAdminText('import_prompt'),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== معالجة استيراد البيانات =====
  if (adminState.currentAction === 'import_data' && adminState.step === 'waiting_data') {
    await importAllData(chatId, text, token, env);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  // ===== إدارة الاشتراك الإجباري =====
  if (text === '➕ إضافة قناة') {
    adminState.currentAction = 'add_channel';
    adminState.step = 'waiting_input';
    await sendMessage(chatId, 
      getAdminText('add_channel_prompt'),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (text === '➕ إضافة مجموعة') {
    adminState.currentAction = 'add_group';
    adminState.step = 'waiting_input';
    await sendMessage(chatId, 
      getAdminText('add_group_prompt'),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (text === '🔄 تفعيل/تعطيل') {
    mandatorySubscription.enabled = !mandatorySubscription.enabled;
    const status = mandatorySubscription.enabled ? 'تفعيل' : 'تعطيل';
    await saveSubscriptionToKV(env);
    await sendMessage(chatId, 
      getAdminText('subscription_toggled', { status }),
      token
    );
    await showSubscriptionManagement(chatId, token);
    return;
  }

  if (text === '🗑️ حذف قناة' || text === '🗑️ حذف مجموعة') {
    await showDeleteSubscriptionMenu(chatId, token);
    return;
  }

  // ===== معالجة إضافة قناة/مجموعة =====
  if (adminState.currentAction === 'add_channel' && adminState.step === 'waiting_input') {
    if (!mandatorySubscription.channels.includes(text)) {
      mandatorySubscription.channels.push(text);
      await saveSubscriptionToKV(env);
      await sendMessage(chatId, getAdminText('channel_added', { id: text }), token);
    } else {
      await sendMessage(chatId, getAdminText('channel_exists', { id: text }), token);
    }
    adminState.currentAction = null;
    adminState.step = null;
    await showSubscriptionManagement(chatId, token);
    return;
  }

  if (adminState.currentAction === 'add_group' && adminState.step === 'waiting_input') {
    if (!mandatorySubscription.groups.includes(text)) {
      mandatorySubscription.groups.push(text);
      await saveSubscriptionToKV(env);
      await sendMessage(chatId, getAdminText('group_added', { id: text }), token);
    } else {
      await sendMessage(chatId, getAdminText('group_exists', { id: text }), token);
    }
    adminState.currentAction = null;
    adminState.step = null;
    await showSubscriptionManagement(chatId, token);
    return;
  }

  // ===== إعدادات البوت =====
  if (text === '✏️ تعديل نص عن البوت') {
    adminState.currentAction = 'edit_about';
    adminState.step = 'waiting_input';
    await sendMessage(chatId, 
      getAdminText('edit_about_prompt', { about: botSettings.aboutText }),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (adminState.currentAction === 'edit_about' && adminState.step === 'waiting_input') {
    botSettings.aboutText = text;
    await saveSettingsToKV(env);
    await sendMessage(chatId, getAdminText('about_updated'), token);
    adminState.currentAction = null;
    adminState.step = null;
    await showBotSettings(chatId, token);
    return;
  }

  // ===== أي شيء آخر =====
  await sendMessage(chatId, getAdminText('unknown'), token);
}

// ========== معالجة وسائط الأدمن ==========

async function handleAdminMedia(chatId, msg, token) {
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content') {
    let fileId = '';
    let type = adminState.tempData.type;
    let caption = msg.caption || '';

    if (msg.video) {
      fileId = msg.video.file_id;
      type = 'video';
    } else if (msg.animation) {
      fileId = msg.animation.file_id;
      type = 'animation';
    } else if (msg.document) {
      fileId = msg.document.file_id;
      type = 'document';
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      fileId = photo.file_id;
      type = 'image';
    }

    if (!adminState.tempData.mediaItems) {
      adminState.tempData.mediaItems = [];
    }

    adminState.tempData.mediaItems.push({
      fileId: fileId,
      type: type,
      caption: caption
    });

    const typeLabel = type === 'image' ? 'صورة' : type === 'video' ? 'فيديو' : 'ملف';
    await sendMessage(chatId, 
      getAdminText('add_content_success', { type: typeLabel }),
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ المحتوى'],
            [getAdminText('cancel')]
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  await sendMessage(chatId, '⚠️ لا يمكنك إرسال وسائط الآن.', token);
}

// ========== حفظ محتوى واحد ==========

async function saveSingleContent(chatId, token, env) {
  const title = adminState.tempData.title;
  const type = adminState.tempData.type;
  const mediaItems = adminState.tempData.mediaItems || [];
  const texts = adminState.tempData.texts || [];
  
  if (type === 'text' && texts.length === 0) {
    await sendMessage(chatId, getAdminText('no_text'), token);
    return;
  }
  
  if ((type === 'image' || type === 'video') && mediaItems.length === 0) {
    await sendMessage(chatId, getAdminText('no_media'), token);
    return;
  }

  const contentId = generateContentId();
  let contentText = '';
  let fileId = null;

  if (type === 'text') {
    contentText = texts.join('\n\n─────────────────\n\n');
  } else if (mediaItems.length === 1) {
    fileId = mediaItems[0].fileId;
    contentText = mediaItems[0].caption || '';
  } else {
    fileId = mediaItems[0].fileId;
    contentText = `📎 عدد الوسائط: ${mediaItems.length}`;
  }

  contentSystem.items[contentId] = {
    id: contentId,
    type: type,
    title: title,
    content: contentText,
    fileId: fileId,
    mediaItems: mediaItems.length > 1 ? mediaItems : null,
    date: new Date().toLocaleString('ar-EG')
  };

  await saveContentToKV(env);

  const botUsername = (await getBotInfo(token)).username;
  const shareLink = `https://t.me/${botUsername}?start=share_${contentId}`;

  await sendMessage(chatId, 
    getAdminText('content_saved', {
      title,
      type,
      contentId,
      count: type === 'text' ? texts.length : mediaItems.length,
      shareLink
    }),
    token
  );
  
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showAdminMainMenu(chatId, token);
}

// ====================================================================
// ========== دوال المستخدم ==========
// ====================================================================

async function showUserMainMenu(chatId, token) {
  const message = getUserText('welcome');

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        [getUserText('search_button')],
        [getUserText('about_button')]
      ],
      resize_keyboard: true
    }
  });
}

async function handleUserSearch(chatId, text, token, userId) {
  if (text === getUserText('search_button')) {
    userState[userId] = { step: 'searching' };
    
    const username = await getUsername(userId, token);
    await logUserAction(userId, username, '🔍 بحث عن محتوى', 'فتح نافذة البحث', token);
    
    await sendMessage(chatId, 
      getUserText('search_prompt'),
      token,
      { 
        reply_markup: { 
          keyboard: [
            [getUserText('back_to_menu')]
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (text === getUserText('about_button')) {
    const username = await getUsername(userId, token);
    await logUserAction(userId, username, 'ℹ️ عن البوت', 'عرض معلومات البوت', token);
    
    await sendMessage(chatId, getUserText('about'), token);
    return;
  }

  if (text === getUserText('back_to_menu')) {
    const username = await getUsername(userId, token);
    await logUserAction(userId, username, '🔙 رجوع', 'العودة إلى القائمة الرئيسية', token);
    
    userState[userId] = { step: 'main' };
    await showUserMainMenu(chatId, token);
    return;
  }

  if (userState[userId] && userState[userId].step === 'searching') {
    const contentId = text.trim();
    const item = contentSystem.items[contentId];
    
    const username = await getUsername(userId, token);
    
    if (item) {
      await logUserAction(userId, username, '📖 مشاهدة محتوى', `رقم ${contentId} - ${item.title}`, token);
      await sendContent(chatId, item, token);
    } else {
      await logUserAction(userId, username, '❌ بحث فاشل', `رقم ${contentId} غير موجود`, token);
      await sendMessage(chatId, 
        getUserText('no_content', { contentId }),
        token
      );
    }
    return;
  }

  const contentId = text.trim();
  const item = contentSystem.items[contentId];
  
  const username = await getUsername(userId, token);
  
  if (item) {
    await logUserAction(userId, username, '📖 مشاهدة محتوى', `رقم ${contentId} - ${item.title}`, token);
    await sendContent(chatId, item, token);
  } else {
    await logUserAction(userId, username, '❌ بحث فاشل', `رقم ${contentId} غير موجود`, token);
    await sendMessage(chatId, 
      getUserText('no_content_search', { contentId }),
      token
    );
  }
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

// ========== إرسال المحتوى للمستخدم ==========

async function sendContent(chatId, item, token) {
  const title = item.title;

  if (item.mediaItems && item.mediaItems.length > 1) {
    const firstMedia = item.mediaItems[0];
    if (firstMedia.type === 'image') {
      await sendPhoto(chatId, firstMedia.fileId, title, token);
    } else if (firstMedia.type === 'video') {
      await sendVideo(chatId, firstMedia.fileId, title, token);
    }
    
    for (let i = 1; i < item.mediaItems.length; i++) {
      const media = item.mediaItems[i];
      if (media.type === 'image') {
        await sendPhoto(chatId, media.fileId, '', token);
      } else if (media.type === 'video') {
        await sendVideo(chatId, media.fileId, '', token);
      }
    }
  } 
  else if (item.fileId && (item.type === 'video' || item.type === 'animation')) {
    await sendVideo(chatId, item.fileId, title, token);
  } else if (item.fileId && item.type === 'image') {
    await sendPhoto(chatId, item.fileId, title, token);
  } else if (item.fileId && item.type === 'document') {
    await sendDocument(chatId, item.fileId, title, token);
  } else {
    await sendMessage(chatId, 
      `${title}\n\n${item.content}`,
      token
    );
  }

  await sendMessage(chatId, getUserText('choose_action'), token, {
    reply_markup: {
      keyboard: [
        [getUserText('search_button')],
        [getUserText('back_to_menu')]
      ],
      resize_keyboard: true
    }
  });
}

// ====================================================================
// ========== دوال إدارة المحتوى ==========
// ====================================================================

async function showContentManagement(chatId, token) {
  const totalItems = Object.keys(contentSystem.items).length;

  const message = getAdminText('content_management', { total: totalItems });

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📦 عرض الكل', '✏️ تعديل محتوى'],
        ['🗑️ حذف محتوى', getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

async function showAllContent(chatId, token) {
  const items = Object.values(contentSystem.items);
  
  if (items.length === 0) {
    await sendMessage(chatId, getAdminText('no_content_list'), token);
    return;
  }

  let message = getAdminText('content_list');
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

async function showDeleteContentMenu(chatId, token) {
  const items = Object.values(contentSystem.items);
  
  if (items.length === 0) {
    await sendMessage(chatId, getAdminText('no_content_delete'), token);
    return;
  }

  const buttons = items.map(item => [
    { text: `🗑️ ${item.id} - ${item.title}`, callback_data: `delete_content_${item.id}` }
  ]);
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, getAdminText('delete_prompt'), token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showEditContentMenu(chatId, token) {
  const items = Object.values(contentSystem.items);
  
  if (items.length === 0) {
    await sendMessage(chatId, getAdminText('no_content_edit'), token);
    return;
  }

  const buttons = items.map(item => [
    { text: `✏️ ${item.id} - ${item.title}`, callback_data: `edit_content_${item.id}` }
  ]);
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, getAdminText('edit_prompt'), token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== دوال إدارة الطلبات ==========
// ====================================================================

async function showRequestsManagement(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  
  const message = getAdminText('requests_management', {
    pending: pendingCount,
    rejected: rejectedCount
  });

  const buttons = [
    [{ text: `📋 الطلبات المعلقة (${pendingCount})`, callback_data: 'show_pending' }],
    [{ text: `❌ المرفوضين (${rejectedCount})`, callback_data: 'show_rejected' }],
    [{ text: `✅ المعتمدين (${Object.keys(approvedUsers).length})`, callback_data: 'show_approved' }],
    [{ text: getAdminText('back'), callback_data: 'admin_back' }]
  ];

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== دوال الاشتراك الإجباري ==========
// ====================================================================

async function showSubscriptionManagement(chatId, token) {
  const status = mandatorySubscription.enabled ? '🟢 مفعل' : '🔴 معطل';
  const channels = mandatorySubscription.channels.length > 0 
    ? mandatorySubscription.channels.join('\n• ') 
    : 'لا يوجد';
  const groups = mandatorySubscription.groups.length > 0 
    ? mandatorySubscription.groups.join('\n• ') 
    : 'لا يوجد';

  const message = getAdminText('subscription_management', {
    status,
    channels,
    groups
  });

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['➕ إضافة قناة', '➕ إضافة مجموعة'],
        ['🗑️ حذف قناة', '🗑️ حذف مجموعة'],
        ['🔄 تفعيل/تعطيل', getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

async function showDeleteSubscriptionMenu(chatId, token) {
  const allSubs = [
    ...mandatorySubscription.channels.map(c => ({ type: 'قناة', id: c })),
    ...mandatorySubscription.groups.map(g => ({ type: 'مجموعة', id: g }))
  ];

  if (allSubs.length === 0) {
    await sendMessage(chatId, getAdminText('no_subscriptions'), token);
    await showSubscriptionManagement(chatId, token);
    return;
  }

  const buttons = allSubs.map(sub => [
    { text: `🗑️ ${sub.type}: ${sub.id}`, callback_data: `delete_sub_${sub.type}_${sub.id}` }
  ]);
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_subscription_back' }]);

  await sendMessage(chatId, getAdminText('delete_sub_prompt'), token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== دوال إعدادات البوت ==========
// ====================================================================

async function showBotSettings(chatId, token) {
  const message = getAdminText('bot_settings', {
    about: botSettings.aboutText,
    logChannel: botSettings.logChannel
  });

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['✏️ تعديل نص عن البوت'],
        [getAdminText('back')]
      ],
      resize_keyboard: true
    }
  });
}

// ====================================================================
// ========== دوال إحصائيات ==========
// ====================================================================

async function showStatistics(chatId, token) {
  const stats = getAdminText('statistics', {
    approved: Object.keys(approvedUsers).length,
    pending: Object.keys(pendingUsers).length,
    rejected: Object.keys(rejectedUsers).length,
    total: Object.keys(contentSystem.items).length,
    images: Object.values(contentSystem.items).filter(i => i.type === 'image').length,
    videos: Object.values(contentSystem.items).filter(i => i.type === 'video').length,
    texts: Object.values(contentSystem.items).filter(i => i.type === 'text').length,
    channels: mandatorySubscription.channels.length,
    groups: mandatorySubscription.groups.length,
    subStatus: mandatorySubscription.enabled ? '🟢 مفعل' : '🔴 معطل',
    logChannel: botSettings.logChannel,
    time: new Date().toLocaleString('ar-EG')
  });

  await sendMessage(chatId, stats, token, {
    reply_markup: { keyboard: [[getAdminText('back')]], resize_keyboard: true }
  });
}

// ====================================================================
// ========== معالجة الكولباك ==========
// ====================================================================

async function handleAdminCallback(data, chatId, messageId, token, env) {
  if (data === 'admin_back') {
    await showAdminMainMenu(chatId, token);
    return;
  }

  if (data === 'admin_content_back') {
    await showContentManagement(chatId, token);
    return;
  }

  if (data === 'admin_subscription_back') {
    await showSubscriptionManagement(chatId, token);
    return;
  }

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

  // ===== إدارة النصوص =====
  if (data.startsWith('edit_text_')) {
    const parts = data.split('_');
    const category = parts[2];
    const key = parts.slice(3).join('_');
    await handleEditText(chatId, category, key, token);
    return;
  }

  // ===== حذف اشتراك =====
  if (data.startsWith('delete_sub_')) {
    const parts = data.split('_');
    const type = parts[2];
    const id = parts.slice(3).join('_');
    
    if (type === 'قناة') {
      const index = mandatorySubscription.channels.indexOf(id);
      if (index !== -1) {
        mandatorySubscription.channels.splice(index, 1);
        await saveSubscriptionToKV(env);
        await sendMessage(chatId, getAdminText('sub_deleted', { type: 'القناة', id }), token);
      }
    } else if (type === 'مجموعة') {
      const index = mandatorySubscription.groups.indexOf(id);
      if (index !== -1) {
        mandatorySubscription.groups.splice(index, 1);
        await saveSubscriptionToKV(env);
        await sendMessage(chatId, getAdminText('sub_deleted', { type: 'المجموعة', id }), token);
      }
    }
    await showSubscriptionManagement(chatId, token);
    return;
  }

  // ===== حذف محتوى =====
  if (data.startsWith('delete_content_')) {
    const contentId = data.replace('delete_content_', '');
    
    if (contentSystem.items[contentId]) {
      delete contentSystem.items[contentId];
      await saveContentToKV(env);
      await sendMessage(chatId, getAdminText('content_deleted', { id: contentId }), token);
      await showContentManagement(chatId, token);
    } else {
      await sendMessage(chatId, getAdminText('content_not_found', { id: contentId }), token);
    }
    return;
  }

  // ===== تعديل محتوى =====
  if (data.startsWith('edit_content_')) {
    const contentId = data.replace('edit_content_', '');
    const item = contentSystem.items[contentId];
    
    if (!item) {
      await sendMessage(chatId, getAdminText('content_not_found', { id: contentId }), token);
      return;
    }

    adminState.currentAction = 'edit_content';
    adminState.step = 'waiting_new_title';
    adminState.tempData.contentId = contentId;
    
    await sendMessage(chatId, 
      getAdminText('edit_title_prompt', { id: contentId, title: item.title }),
      token,
      { 
        reply_markup: { 
          keyboard: [[getAdminText('cancel')]], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== قبول/رفض الطلبات =====
  if (data.startsWith('approve_')) {
    const targetId = data.split('_')[1];
    if (pendingUsers[targetId]) {
      approvedUsers[targetId] = pendingUsers[targetId];
      delete pendingUsers[targetId];
      delete rejectedUsers[targetId];
      await saveUsersToKV(env);
      
      const username = pendingUsers[targetId]?.username || null;
      await logUserAction(targetId, username, '✅ موافقة', 'تمت الموافقة على طلب الانضمام', token);
      
      await sendMessage(targetId, getUserText('approved'), token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, getAdminText('approved_user'), token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('reject_')) {
    const targetId = data.split('_')[1];
    if (pendingUsers[targetId]) {
      rejectedUsers[targetId] = pendingUsers[targetId];
      delete pendingUsers[targetId];
      delete approvedUsers[targetId];
      await saveUsersToKV(env);
      
      const username = pendingUsers[targetId]?.username || null;
      await logUserAction(targetId, username, '❌ رفض', 'تم رفض طلب الانضمام', token);
      
      await sendMessage(targetId, getUserText('rejected'), token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, getAdminText('rejected_user'), token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('reapprove_')) {
    const targetId = data.split('_')[1];
    if (rejectedUsers[targetId]) {
      approvedUsers[targetId] = rejectedUsers[targetId];
      delete rejectedUsers[targetId];
      delete pendingUsers[targetId];
      await saveUsersToKV(env);
      
      const username = rejectedUsers[targetId]?.username || null;
      await logUserAction(targetId, username, '✅ إعادة موافقة', 'تم إعادة الموافقة على الطلب', token);
      
      await sendMessage(targetId, getUserText('reapproved'), token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, getAdminText('reapproved_user'), token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('details_')) {
    const targetId = data.split('_')[1];
    let userInfo = pendingUsers[targetId] || rejectedUsers[targetId] || approvedUsers[targetId];
    
    if (userInfo) {
      const status = pendingUsers[targetId] ? '⏳ معلق' : 
                    rejectedUsers[targetId] ? '❌ مرفوض' : '✅ معتمد';
      
      const details = getAdminText('user_details', {
        name: userInfo.name,
        username: userInfo.username,
        phone: userInfo.phone,
        time: userInfo.time,
        status
      });
      
      await sendMessage(chatId, details, token);
    }
    return;
  }

  if (data.startsWith('delete_user_')) {
    const targetId = data.split('_')[2];
    if (rejectedUsers[targetId]) {
      delete rejectedUsers[targetId];
      await saveUsersToKV(env);
      await sendMessage(chatId, getAdminText('user_deleted'), token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }
}

// ====================================================================
// ========== عرض القوائم ==========
// ====================================================================

async function showPendingRequests(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  if (pendingList.length === 0) {
    await sendMessage(chatId, getAdminText('no_pending'), token, {
      reply_markup: { inline_keyboard: [[{ text: getAdminText('back'), callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = getAdminText('pending_list');
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
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showRejectedRequests(chatId, token) {
  const rejectedList = Object.values(rejectedUsers);
  if (rejectedList.length === 0) {
    await sendMessage(chatId, getAdminText('no_rejected'), token, {
      reply_markup: { inline_keyboard: [[{ text: getAdminText('back'), callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = getAdminText('rejected_list');
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
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showApprovedUsers(chatId, token) {
  const approvedList = Object.values(approvedUsers);
  if (approvedList.length === 0) {
    await sendMessage(chatId, getAdminText('no_approved'), token, {
      reply_markup: { inline_keyboard: [[{ text: getAdminText('back'), callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = getAdminText('approved_list');
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
  
  buttons.push([{ text: getAdminText('back'), callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== دوال مساعدة ==========
// ====================================================================

function generateContentId() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

async function getBotInfo(token) {
  const url = `https://api.telegram.org/bot${token}/getMe`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.result || { username: 'bot' };
  } catch (error) {
    return { username: 'bot' };
  }
}

async function sendMessage(chatId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { chat_id: chatId, text: text, parse_mode: 'HTML', ...options };

  try {
    console.log(`📤 إرسال رسالة إلى: ${chatId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log('📥 نتيجة الإرسال:', data.ok ? '✅ نجاح' : '❌ فشل');
    if (!data.ok) {
      console.log('❌ سبب الفشل:', data.description);
    }
    return data;
  } catch (error) {
    console.error('❌ خطأ في إرسال الرسالة:', error);
    return { ok: false, error: error.message };
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
// ========== دوال إرسال الوسائط ==========
// ====================================================================

async function sendVideo(chatId, fileId, caption, token) {
  const url = `https://api.telegram.org/bot${token}/sendVideo`;
  
  const payload = {
    chat_id: chatId,
    video: fileId,
    caption: caption || '',
    parse_mode: 'HTML'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending video:', error);
    await sendMessage(chatId, getUserText('video_error'), token);
  }
}

async function sendPhoto(chatId, fileId, caption, token) {
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  
  const payload = {
    chat_id: chatId,
    photo: fileId,
    caption: caption || '',
    parse_mode: 'HTML'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending photo:', error);
    await sendMessage(chatId, getUserText('photo_error'), token);
  }
}

async function sendDocument(chatId, fileId, caption, token) {
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  
  const payload = {
    chat_id: chatId,
    document: fileId,
    caption: caption || '',
    parse_mode: 'HTML'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending document:', error);
    await sendMessage(chatId, getUserText('document_error'), token);
  }
}
