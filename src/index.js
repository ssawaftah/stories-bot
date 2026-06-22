// ========== التخزين المؤقت ==========
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// ========== نظام المحتوى ==========
const contentSystem = {
  items: {}, // key: contentId, value: { id, type, title, content, fileId, date }
  nextId: 10000
};

// ========== نظام الاشتراك الإجباري ==========
const mandatorySubscription = {
  channels: [], // قائمة المعرفات (مثل: @channel, -100123456)
  bots: [],
  groups: [],
  enabled: false
};

// ========== إعدادات البوت ==========
const botSettings = {
  aboutText: '📌 بوت رفع ومشاهدة المحتوى\n🔍 أرسل رقم المحتوى لمشاهدته'
};

// ========== حالة الأدمن ==========
const adminState = {
  currentAction: null,
  step: null,
  tempData: {}
};

// ========== حالة المستخدم ==========
const userState = {};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
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
      await handleAdminActions(chatId, text, token);
      return;
    }

    // ========== واجهة المستخدم ==========
    if (rejectedUsers[userId]) {
      await sendMessage(chatId, '❌ عذراً، طلبك مرفوض.\nللتواصل: @jahab', token, {
        reply_markup: { remove_keyboard: true }
      });
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
        await sendMessage(chatId, '⏳ طلبك قيد المراجعة...', token, {
          reply_markup: { remove_keyboard: true }
        });
        return;
      }

      await sendMessage(chatId, '🔐 للتحقق، شارك رقم هاتفك:', token, {
        reply_markup: {
          keyboard: [[{ text: '📱 مشاركة الرقم', request_contact: true }]],
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

      await sendMessage(chatId, '⏳ تم استلام طلبك! جاري التحقق...', token, {
        reply_markup: { remove_keyboard: true }
      });

      const adminMsg = `📢 طلب انضمام جديد!\n👤 ${userData.name}\n🆔 @${userData.username}\n📱 ${userData.phone}`;
      await sendMessage(ADMIN_ID, adminMsg, token);
      return;
    }

    if (!approvedUsers[userId]) {
      await sendMessage(chatId, '🔐 يرجى مشاركة رقم هاتفك أولاً.\nاضغط /start', token);
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
      await handleAdminCallback(data, chatId, messageId, token);
      await answerCallbackQuery(query.id, '✅ تم', token);
      return;
    }

    await handleUserCallback(data, chatId, token, userId);
    await answerCallbackQuery(query.id, '✅ تم', token);
    return;
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
    console.error('Error checking subscription:', error);
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
  let message = '🔐 للوصول إلى محتوى البوت، يجب عليك الاشتراك في القنوات التالية:\n\n';
  
  for (const channel of mandatorySubscription.channels) {
    message += `• ${channel}\n`;
  }
  for (const group of mandatorySubscription.groups) {
    message += `• ${group}\n`;
  }
  
  message += '\n✅ بعد الاشتراك، اضغط /start مرة أخرى.';
  
  await sendMessage(chatId, message, token);
}

// ====================================================================
// ========== دوال الأدمن ==========
// ====================================================================

async function showAdminMainMenu(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const contentCount = Object.keys(contentSystem.items).length;
  const subscriptionCount = mandatorySubscription.channels.length + mandatorySubscription.groups.length;

  const message = `👋 مرحباً بك في لوحة التحكم

📊 الإحصائيات:
• 📋 طلبات جديدة: ${pendingCount}
• 📦 محتوى: ${contentCount}
• 🔗 اشتراكات إجبارية: ${subscriptionCount}

📌 اختر الإدارة المناسبة:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['➕ إضافة محتوى', '📋 إدارة الطلبات'],
        ['📦 إدارة المحتوى', '🔗 الاشتراك الإجباري'],
        ['⚙️ إعدادات البوت', '📊 الإحصائيات'],
        ['🔙 العودة']
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminActions(chatId, text, token) {
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
      
    case '⚙️ إعدادات البوت':
      await showBotSettings(chatId, token);
      break;
      
    case '📊 الإحصائيات':
      await showStatistics(chatId, token);
      break;
      
    case '🔙 العودة':
    case 'رجوع':
    case '🔙 إلغاء':
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showAdminMainMenu(chatId, token);
      break;
      
    default:
      await handleAdminSubActions(chatId, text, token);
      break;
  }
}

// ========== إضافة محتوى ==========

async function showAddContentMenu(chatId, token) {
  const message = `➕ إضافة محتوى جديد

اختر نوع المحتوى:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['🖼️ صورة', '🎬 فيديو', '📝 نص'],
        ['🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminSubActions(chatId, text, token) {
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
    adminState.tempData.mediaItems = []; // تخزين الوسائط المتعددة
    
    await sendMessage(chatId, 
      `أدخل عنوان المحتوى (نوع: ${text}):`,
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
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
      `${instruction}\n\n(اضغط "حفظ" عند الانتهاء)`,
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ المحتوى'],
            ['🔙 إلغاء']
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== حفظ المحتوى =====
  if (text === '✅ حفظ المحتوى' && adminState.currentAction === 'add_content') {
    await saveSingleContent(chatId, token);
    return;
  }

  // ===== إلغاء =====
  if (text === '🔙 إلغاء' || text === '🔙 رجوع') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
    return;
  }

  // ===== معالجة النص (تجميع النصوص في محتوى واحد) =====
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content') {
    if (adminState.tempData.type === 'text') {
      if (!adminState.tempData.texts) {
        adminState.tempData.texts = [];
      }
      adminState.tempData.texts.push(text);
      
      await sendMessage(chatId, 
        `✅ تم إضافة النص\nأرسل النص التالي أو اضغط "حفظ المحتوى":`,
        token,
        { 
          reply_markup: { 
            keyboard: [
              ['✅ حفظ المحتوى'],
              ['🔙 إلغاء']
            ], 
            resize_keyboard: true 
          }
        }
      );
    }
    return;
  }

  // ===== إدارة المحتوى =====
  if (text === '📦 عرض الكل') {
    await showAllContent(chatId, token);
    return;
  }

  if (text === '🗑️ حذف محتوى') {
    await showDeleteContentMenu(chatId, token);
    return;
  }

  if (text === '✏️ تعديل محتوى') {
    await showEditContentMenu(chatId, token);
    return;
  }

  // ===== إدارة الاشتراك الإجباري =====
  if (text === '➕ إضافة قناة') {
    adminState.currentAction = 'add_channel';
    adminState.step = 'waiting_input';
    await sendMessage(chatId, 
      'أدخل معرف القناة (مثل: @channel أو -100123456):',
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
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
      'أدخل معرف المجموعة (مثل: -100123456):',
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (text === '🔄 تفعيل/تعطيل') {
    mandatorySubscription.enabled = !mandatorySubscription.enabled;
    await sendMessage(chatId, 
      `✅ تم ${mandatorySubscription.enabled ? 'تفعيل' : 'تعطيل'} الاشتراك الإجباري`,
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
      await sendMessage(chatId, `✅ تم إضافة القناة ${text}`, token);
    } else {
      await sendMessage(chatId, `⚠️ القناة ${text} موجودة بالفعل`, token);
    }
    adminState.currentAction = null;
    adminState.step = null;
    await showSubscriptionManagement(chatId, token);
    return;
  }

  if (adminState.currentAction === 'add_group' && adminState.step === 'waiting_input') {
    if (!mandatorySubscription.groups.includes(text)) {
      mandatorySubscription.groups.push(text);
      await sendMessage(chatId, `✅ تم إضافة المجموعة ${text}`, token);
    } else {
      await sendMessage(chatId, `⚠️ المجموعة ${text} موجودة بالفعل`, token);
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
      `أدخل النص الجديد لـ "عن البوت":\n\nالنص الحالي:\n${botSettings.aboutText}`,
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (adminState.currentAction === 'edit_about' && adminState.step === 'waiting_input') {
    botSettings.aboutText = text;
    await sendMessage(chatId, '✅ تم تحديث نص "عن البوت"', token);
    adminState.currentAction = null;
    adminState.step = null;
    await showBotSettings(chatId, token);
    return;
  }

  // ===== معالجة تعديل المحتوى =====
  if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_new_title') {
    adminState.tempData.newTitle = text;
    adminState.step = 'waiting_new_content';
    
    await sendMessage(chatId, 
      `أدخل المحتوى الجديد:`,
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
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
      if (item.type === 'text') {
        item.content = text;
      } else {
        item.content = text;
      }
      item.title = adminState.tempData.newTitle;
      item.date = new Date().toLocaleString('ar-EG');
      
      await sendMessage(chatId, `✅ تم تعديل المحتوى رقم ${contentId}`, token);
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showContentManagement(chatId, token);
    }
    return;
  }

  // ===== أي شيء آخر =====
  await sendMessage(chatId, '⚠️ خيار غير معروف. استخدم الأزرار.', token);
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
      `✅ تم إضافة ${typeLabel}\nأرسل المزيد أو اضغط "حفظ المحتوى":`,
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ المحتوى'],
            ['🔙 إلغاء']
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  await sendMessage(chatId, '⚠️ لا يمكنك إرسال وسائط الآن.', token);
}

// ========== حفظ محتوى واحد (متعدد الوسائط) ==========

async function saveSingleContent(chatId, token) {
  const title = adminState.tempData.title;
  const type = adminState.tempData.type;
  const mediaItems = adminState.tempData.mediaItems || [];
  const texts = adminState.tempData.texts || [];
  
  if (type === 'text' && texts.length === 0) {
    await sendMessage(chatId, '⚠️ لم يتم إضافة أي نص!', token);
    return;
  }
  
  if ((type === 'image' || type === 'video') && mediaItems.length === 0) {
    await sendMessage(chatId, '⚠️ لم يتم إضافة أي وسائط!', token);
    return;
  }

  const contentId = generateContentId();
  let contentText = '';
  let fileId = null;

  if (type === 'text') {
    contentText = texts.join('\n\n─────────────────\n\n');
  } else if (mediaItems.length === 1) {
    // وسيط واحد
    fileId = mediaItems[0].fileId;
    contentText = mediaItems[0].caption || '';
  } else {
    // عدة وسائط - نخزنها كقائمة
    const mediaList = mediaItems.map((item, index) => {
      return `[${index + 1}] ${item.caption || 'بدون وصف'}`;
    }).join('\n');
    fileId = mediaItems[0].fileId; // نحتفظ بأول fileId للعرض
    contentText = `📎 عدد الوسائط: ${mediaItems.length}\n\n${mediaList}`;
  }

  contentSystem.items[contentId] = {
    id: contentId,
    type: type,
    title: title,
    content: contentText,
    fileId: fileId,
    mediaItems: mediaItems.length > 1 ? mediaItems : null, // حفظ جميع الوسائط
    date: new Date().toLocaleString('ar-EG')
  };

  const botUsername = (await getBotInfo(token)).username;
  const shareLink = `https://t.me/${botUsername}?start=share_${contentId}`;

  await sendMessage(chatId, 
    `✅ تم حفظ المحتوى بنجاح!\n\nالعنوان: ${title}\nالنوع: ${type}\nالرقم: ${contentId}\nعدد العناصر: ${type === 'text' ? texts.length : mediaItems.length}\n\nرابط المشاركة:\n${shareLink}`,
    token
  );
  
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showAdminMainMenu(chatId, token);
}

// ========== إرسال المحتوى للمستخدم ==========

async function sendContent(chatId, item, token) {
  const caption = `${item.title}\n\nرقم: ${item.id}\n${item.date}`;

  // إذا كان هناك وسائط متعددة
  if (item.mediaItems && item.mediaItems.length > 1) {
    // إرسال أول وسيط مع قائمة
    const firstMedia = item.mediaItems[0];
    if (firstMedia.type === 'image') {
      await sendPhoto(chatId, firstMedia.fileId, `${item.title}\n\nرقم: ${item.id}\n${item.date}\n\n📎 ${item.mediaItems.length} وسائط`, token);
    } else if (firstMedia.type === 'video') {
      await sendVideo(chatId, firstMedia.fileId, `${item.title}\n\nرقم: ${item.id}\n${item.date}\n\n📎 ${item.mediaItems.length} وسائط`, token);
    }
    
    // إرسال باقي الوسائط كمجموعة
    for (let i = 1; i < item.mediaItems.length; i++) {
      const media = item.mediaItems[i];
      if (media.type === 'image') {
        await sendPhoto(chatId, media.fileId, `[${i+1}] ${media.caption || ''}`, token);
      } else if (media.type === 'video') {
        await sendVideo(chatId, media.fileId, `[${i+1}] ${media.caption || ''}`, token);
      }
    }
    
    await sendMessage(chatId, `📎 إجمالي ${item.mediaItems.length} وسائط`, token);
  } 
  // وسيط واحد
  else if (item.fileId && (item.type === 'video' || item.type === 'animation')) {
    await sendVideo(chatId, item.fileId, caption, token);
  } else if (item.fileId && item.type === 'image') {
    await sendPhoto(chatId, item.fileId, caption, token);
  } else if (item.fileId && item.type === 'document') {
    await sendDocument(chatId, item.fileId, caption, token);
  } else {
    // نص عادي
    await sendMessage(chatId, 
      `${item.title}\n\n${item.content}\n\nرقم: ${item.id}\n${item.date}`,
      token
    );
  }

  await sendMessage(chatId, '🔍 للبحث عن محتوى آخر استخدم الزر:', token, {
    reply_markup: {
      keyboard: [
        ['🔍 البحث عن محتوى'],
        ['🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

// ====================================================================
// ========== إدارة الاشتراك الإجباري ==========
// ====================================================================

async function showSubscriptionManagement(chatId, token) {
  const status = mandatorySubscription.enabled ? '🟢 مفعل' : '🔴 معطل';
  const channels = mandatorySubscription.channels.length > 0 
    ? mandatorySubscription.channels.join('\n• ') 
    : 'لا يوجد';
  const groups = mandatorySubscription.groups.length > 0 
    ? mandatorySubscription.groups.join('\n• ') 
    : 'لا يوجد';

  const message = `🔗 إدارة الاشتراك الإجباري

📊 الحالة: ${status}

📢 القنوات:
• ${channels}

👥 المجموعات:
• ${groups}

اختر الإجراء:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['➕ إضافة قناة', '➕ إضافة مجموعة'],
        ['🗑️ حذف قناة', '🗑️ حذف مجموعة'],
        ['🔄 تفعيل/تعطيل', '🔙 رجوع']
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
    await sendMessage(chatId, '⚠️ لا يوجد اشتراكات للحذف', token);
    await showSubscriptionManagement(chatId, token);
    return;
  }

  const buttons = allSubs.map(sub => [
    { text: `🗑️ ${sub.type}: ${sub.id}`, callback_data: `delete_sub_${sub.type}_${sub.id}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_subscription_back' }]);

  await sendMessage(chatId, '🗑️ اختر الاشتراك للحذف:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== إعدادات البوت ==========
// ====================================================================

async function showBotSettings(chatId, token) {
  const message = `⚙️ إعدادات البوت

📝 نص "عن البوت":
${botSettings.aboutText}

الإجراءات:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['✏️ تعديل نص عن البوت'],
        ['🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

// ====================================================================
// ========== إدارة الطلبات ==========
// ====================================================================

async function showRequestsManagement(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  const rejectedList = Object.values(rejectedUsers);
  
  let message = `📋 إدارة الطلبات\n\n📌 المعلقة: ${pendingList.length}\n❌ المرفوضة: ${rejectedList.length}\n\nاختر القائمة:`;

  const buttons = [
    [{ text: `📋 الطلبات المعلقة (${pendingList.length})`, callback_data: 'show_pending' }],
    [{ text: `❌ المرفوضين (${rejectedList.length})`, callback_data: 'show_rejected' }],
    [{ text: `✅ المعتمدين (${Object.keys(approvedUsers).length})`, callback_data: 'show_approved' }],
    [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
  ];

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== إدارة المحتوى ==========
// ====================================================================

async function showContentManagement(chatId, token) {
  const totalItems = Object.keys(contentSystem.items).length;

  const message = `📦 إدارة المحتوى

📊 الإحصائيات:
• 📦 مجموع المحتويات: ${totalItems}

🔸 الإجراءات:
• 📦 عرض الكل
• ✏️ تعديل محتوى
• 🗑️ حذف محتوى`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📦 عرض الكل', '✏️ تعديل محتوى'],
        ['🗑️ حذف محتوى', '🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

async function showAllContent(chatId, token) {
  const items = Object.values(contentSystem.items);
  
  if (items.length === 0) {
    await sendMessage(chatId, '📦 لا يوجد محتوى', token);
    return;
  }

  let message = '📦 قائمة المحتويات:\n\n';
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
    await sendMessage(chatId, '📦 لا يوجد محتوى للحذف', token);
    return;
  }

  const buttons = items.map(item => [
    { text: `🗑️ ${item.id} - ${item.title}`, callback_data: `delete_content_${item.id}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '🗑️ اختر المحتوى للحذف:', token, {
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
    { text: `✏️ ${item.id} - ${item.title}`, callback_data: `edit_content_${item.id}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '✏️ اختر المحتوى للتعديل:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== دوال المستخدم ==========
// ====================================================================

async function showUserMainMenu(chatId, token) {
  const message = `🎉 مرحباً بك في البوت!

🔍 ابحث عن محتوى عبر إرسال رقم المحتوى.
📌 أو استخدم الأزرار أدناه:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['🔍 البحث عن محتوى'],
        ['ℹ️ عن البوت']
      ],
      resize_keyboard: true
    }
  });
}

async function handleUserSearch(chatId, text, token, userId) {
  if (text === '🔍 البحث عن محتوى') {
    userState[userId] = { step: 'searching' };
    await sendMessage(chatId, 
      'أرسل رقم المحتوى الذي تريد مشاهدته:',
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['🔙 رجوع']
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  if (text === 'ℹ️ عن البوت') {
    await sendMessage(chatId, botSettings.aboutText, token);
    return;
  }

  if (text === '🔙 رجوع') {
    userState[userId] = { step: 'main' };
    await showUserMainMenu(chatId, token);
    return;
  }

  if (userState[userId] && userState[userId].step === 'searching') {
    const contentId = text.trim();
    const item = contentSystem.items[contentId];
    
    if (item) {
      await sendContent(chatId, item, token);
    } else {
      await sendMessage(chatId, 
        `❌ لا يوجد محتوى برقم ${contentId}\n\nتأكد من الرقم وحاول مرة أخرى:`,
        token
      );
    }
    return;
  }

  const contentId = text.trim();
  const item = contentSystem.items[contentId];
  
  if (item) {
    await sendContent(chatId, item, token);
  } else {
    await sendMessage(chatId, 
      `❌ لا يوجد محتوى برقم ${contentId}\n\n🔍 استخدم زر "البحث عن محتوى"`,
      token
    );
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
    await sendMessage(chatId, '⚠️ حدث خطأ في عرض الفيديو', token);
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
    await sendMessage(chatId, '⚠️ حدث خطأ في عرض الصورة', token);
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
    await sendMessage(chatId, '⚠️ حدث خطأ في عرض الملف', token);
  }
}

// ====================================================================
// ========== معالجة الكولباك ==========
// ====================================================================

async function handleAdminCallback(data, chatId, messageId, token) {
  // ===== رجوع =====
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

  // ===== حذف اشتراك =====
  if (data.startsWith('delete_sub_')) {
    const parts = data.split('_');
    const type = parts[2];
    const id = parts.slice(3).join('_');
    
    if (type === 'قناة') {
      const index = mandatorySubscription.channels.indexOf(id);
      if (index !== -1) {
        mandatorySubscription.channels.splice(index, 1);
        await sendMessage(chatId, `✅ تم حذف القناة ${id}`, token);
      }
    } else if (type === 'مجموعة') {
      const index = mandatorySubscription.groups.indexOf(id);
      if (index !== -1) {
        mandatorySubscription.groups.splice(index, 1);
        await sendMessage(chatId, `✅ تم حذف المجموعة ${id}`, token);
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
      await sendMessage(chatId, `✅ تم حذف المحتوى رقم ${contentId}`, token);
      await showContentManagement(chatId, token);
    } else {
      await sendMessage(chatId, `⚠️ المحتوى رقم ${contentId} غير موجود`, token);
    }
    return;
  }

  // ===== تعديل محتوى =====
  if (data.startsWith('edit_content_')) {
    const contentId = data.replace('edit_content_', '');
    const item = contentSystem.items[contentId];
    
    if (!item) {
      await sendMessage(chatId, `⚠️ المحتوى رقم ${contentId} غير موجود`, token);
      return;
    }

    adminState.currentAction = 'edit_content';
    adminState.step = 'waiting_new_title';
    adminState.tempData.contentId = contentId;
    
    await sendMessage(chatId, 
      `✏️ تعديل المحتوى رقم ${contentId}\nالعنوان الحالي: ${item.title}\n\nأدخل العنوان الجديد:`,
      token,
      { 
        reply_markup: { 
          keyboard: [['🔙 إلغاء']], 
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
      
      await sendMessage(targetId, '✅ تمت الموافقة! اضغط /start', token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, '✅ تم القبول', token);
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
      
      await sendMessage(targetId, '❌ طلبك مرفوض. للتواصل: @jahab', token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, '❌ تم الرفض', token);
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
      
      await sendMessage(targetId, '✅ تم استئناف طلبك! اضغط /start', token, {
        reply_markup: { remove_keyboard: true }
      });
      await sendMessage(chatId, '✅ تم إعادة الموافقة', token);
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
      
      const details = `
📋 تفاصيل المستخدم:
👤 الاسم: ${userInfo.name}
🆔 اليوزرنيم: @${userInfo.username}
📱 رقم الهاتف: ${userInfo.phone}
🕐 تاريخ الطلب: ${userInfo.time}
📌 الحالة: ${status}`;
      
      await sendMessage(chatId, details, token);
    }
    return;
  }

  if (data.startsWith('delete_user_')) {
    const targetId = data.split('_')[2];
    if (rejectedUsers[targetId]) {
      delete rejectedUsers[targetId];
      await sendMessage(chatId, '🗑️ تم حذف المستخدم', token);
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
    await sendMessage(chatId, '📋 لا توجد طلبات معلقة', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = '📋 الطلبات المعلقة:\n\n';
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

  let message = '❌ المرفوضين:\n\n';
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

  let message = '✅ المعتمدين:\n\n';
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

// ====================================================================
// ========== إحصائيات ==========
// ====================================================================

async function showStatistics(chatId, token) {
  const stats = `📊 الإحصائيات العامة:

👥 المستخدمين:
• ✅ معتمدين: ${Object.keys(approvedUsers).length}
• ⏳ معلق: ${Object.keys(pendingUsers).length}
• ❌ مرفوض: ${Object.keys(rejectedUsers).length}

📦 المحتوى:
• 📦 مجموع: ${Object.keys(contentSystem.items).length}
• 🖼️ صور: ${Object.values(contentSystem.items).filter(i => i.type === 'image').length}
• 🎬 فيديو: ${Object.values(contentSystem.items).filter(i => i.type === 'video').length}
• 📝 نصوص: ${Object.values(contentSystem.items).filter(i => i.type === 'text').length}

🔗 الاشتراك الإجباري:
• 📢 قنوات: ${mandatorySubscription.channels.length}
• 👥 مجموعات: ${mandatorySubscription.groups.length}
• 📌 الحالة: ${mandatorySubscription.enabled ? '🟢 مفعل' : '🔴 معطل'}

⏱️ آخر تحديث: ${new Date().toLocaleString('ar-EG')}`;

  await sendMessage(chatId, stats, token, {
    reply_markup: { keyboard: [['🔙 العودة']], resize_keyboard: true }
  });
}

// ====================================================================
// ========== معالجة كولباك المستخدم ==========
// ====================================================================

async function handleUserCallback(data, chatId, token, userId) {
  // لا يوجد كولباك للمستخدم في هذا الإصدار
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
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
    console.error('Error:', error);
  }
}
