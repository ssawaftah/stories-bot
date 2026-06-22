// ========== التخزين المؤقت ==========
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// ========== نظام الواجهة الرئيسية ==========
const mainInterface = {
  structure: {},
  order: []
};

// ========== نظام المحتوى ==========
const contentSystem = {
  sections: {}
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
      // معالجة الفيديو والصورة من الأدمن
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
        userState[userId] = { currentPath: [] };
        await showUserMainMenu(chatId, token, userId);
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

    await handleUserTextSelection(chatId, text, token, userId);
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

// ========== معالجة وسائط الأدمن ==========

async function handleAdminMedia(chatId, msg, token) {
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content_body') {
    let mediaUrl = '';
    let mediaType = 'text';
    let caption = msg.caption || '';

    if (msg.video) {
      mediaUrl = msg.video.file_id;
      mediaType = 'video';
    } else if (msg.animation) {
      mediaUrl = msg.animation.file_id;
      mediaType = 'animation';
    } else if (msg.document) {
      mediaUrl = msg.document.file_id;
      mediaType = 'document';
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      mediaUrl = photo.file_id;
      mediaType = 'image';
    }

    const contentText = caption || mediaUrl;

    if (!adminState.tempData.items) {
      adminState.tempData.items = [];
    }

    adminState.tempData.items.push({
      id: Date.now() + Math.random(),
      title: adminState.tempData.currentTitle || 'بدون عنوان',
      content: contentText,
      type: mediaType,
      fileId: mediaUrl,
      created: new Date().toLocaleString('ar-EG')
    });

    await sendMessage(chatId, 
      `✅ تم إضافة "${adminState.tempData.currentTitle}"\n📝 أدخل عنوان التالي أو اضغط "حفظ الكل":`,
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ الكل'],
            ['🔙 إلغاء']
          ], 
          resize_keyboard: true 
        }
      }
    );
    
    adminState.step = 'waiting_content_title';
    return;
  }

  await sendMessage(chatId, '⚠️ لا يمكنك إرسال وسائط الآن. استخدم الأزرار.', token);
}

// ====================================================================
// ========== قائمة الأدمن الرئيسية ==========
// ====================================================================

async function showAdminMainMenu(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  const approvedCount = Object.keys(approvedUsers).length;
  const interfaceCount = Object.keys(mainInterface.structure).length;
  const contentCount = Object.keys(contentSystem.sections).length;

  const message = `👋 مرحباً بك في لوحة التحكم

📊 الإحصائيات العامة:
• 📋 طلبات جديدة: ${pendingCount}
• ❌ مرفوضين: ${rejectedCount}
• ✅ معتمدين: ${approvedCount}
• 🎯 عناصر الواجهة: ${interfaceCount}
• 📝 أقسام المحتوى: ${contentCount}

📌 اختر الإدارة المناسبة:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📋 إدارة الطلبات', '🎯 إدارة الواجهة'],
        ['📝 إدارة المحتوى', '📊 الإحصائيات'],
        ['📢 إرسال إشعار', '🔙 العودة']
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminActions(chatId, text, token) {
  switch(text) {
    case '📋 إدارة الطلبات':
      await showRequestsManagement(chatId, token);
      break;
      
    case '🎯 إدارة الواجهة':
      await showInterfaceManagement(chatId, token);
      break;
      
    case '📝 إدارة المحتوى':
      await showContentManagementMain(chatId, token);
      break;
      
    case '📊 الإحصائيات':
      await showStatistics(chatId, token);
      break;
      
    case '📢 إرسال إشعار':
      adminState.currentAction = 'broadcast';
      adminState.step = 'waiting_message';
      await sendMessage(chatId, '📝 أرسل الرسالة:', token, {
        reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
      });
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

// ====================================================================
// ========== الإجراءات الفرعية للأدمن ==========
// ====================================================================

async function handleAdminSubActions(chatId, text, token) {
  // ===== إنشاء مجلد =====
  if (text === '📁 إنشاء مجلد') {
    adminState.currentAction = 'create_folder';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📁 أدخل اسم المجلد الجديد:', token, {
      reply_markup: { 
        keyboard: [['🔙 إلغاء']], 
        resize_keyboard: true 
      }
    });
    return;
  }

  // ===== إنشاء قسم =====
  if (text === '📂 إنشاء قسم') {
    adminState.currentAction = 'create_section';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📂 أدخل اسم القسم الجديد:', token, {
      reply_markup: { 
        keyboard: [['🔙 إلغاء']], 
        resize_keyboard: true 
      }
    });
    return;
  }

  // ===== إنشاء زر =====
  if (text === '🔘 إنشاء زر') {
    adminState.currentAction = 'create_button';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '🔘 أدخل اسم الزر الجديد:', token, {
      reply_markup: { 
        keyboard: [['🔙 إلغاء']], 
        resize_keyboard: true 
      }
    });
    return;
  }

  // ===== تعديل عنصر =====
  if (text === '✏️ تعديل عنصر') {
    await showEditElement(chatId, token);
    return;
  }

  // ===== حذف عنصر =====
  if (text === '🗑️ حذف عنصر') {
    await showDeleteElement(chatId, token);
    return;
  }

  // ===== ترتيب العناصر =====
  if (text === '📊 ترتيب العناصر') {
    await showReorderElements(chatId, token);
    return;
  }

  // ===== نقل قسم لمجلد =====
  if (text === '📂 نقل قسم لمجلد') {
    await showMoveSectionToFolder(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - إنشاء قسم محتوى =====
  if (text === '📂 إنشاء قسم محتوى') {
    adminState.currentAction = 'create_content_section';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📂 أدخل اسم قسم المحتوى الجديد:', token, {
      reply_markup: { 
        keyboard: [['🔙 إلغاء']], 
        resize_keyboard: true 
      }
    });
    return;
  }

  // ===== إدارة المحتوى - تعديل قسم محتوى =====
  if (text === '✏️ تعديل قسم محتوى') {
    await showEditContentSection(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - حذف قسم محتوى =====
  if (text === '🗑️ حذف قسم محتوى') {
    await showDeleteContentSection(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - إضافة محتوى =====
  if (text === '➕ إضافة محتوى') {
    await showAddContent(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - تعديل محتوى =====
  if (text === '✏️ تعديل محتوى') {
    await showEditContent(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - حذف محتوى =====
  if (text === '🗑️ حذف محتوى') {
    await showDeleteContent(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - ترتيب المحتوى =====
  if (text === '📊 ترتيب المحتوى') {
    await showReorderContent(chatId, token);
    return;
  }

  // ===== إدارة المحتوى - نسخ محتوى =====
  if (text === '📋 نسخ محتوى') {
    await showCopyContent(chatId, token);
    return;
  }

  // ===== معالجة إنشاء المجلد =====
  if (adminState.currentAction === 'create_folder' && adminState.step === 'waiting_name') {
    await handleCreateFolder(chatId, text, token);
    return;
  }

  // ===== معالجة إنشاء القسم =====
  if (adminState.currentAction === 'create_section' && adminState.step === 'waiting_name') {
    await handleCreateSection(chatId, text, token);
    return;
  }

  // ===== معالجة إنشاء الزر =====
  if (adminState.currentAction === 'create_button' && adminState.step === 'waiting_name') {
    adminState.tempData.buttonName = text;
    adminState.step = 'waiting_button_content';
    await sendMessage(chatId, 
      `🔘 أدخل محتوى الزر "${text}":\n(يمكنك استخدام HTML للتنسيق)`,
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

  // ===== معالجة حفظ الزر =====
  if (adminState.currentAction === 'create_button' && adminState.step === 'waiting_button_content') {
    await handleSaveButton(chatId, text, token);
    return;
  }

  // ===== معالجة إنشاء قسم محتوى =====
  if (adminState.currentAction === 'create_content_section' && adminState.step === 'waiting_name') {
    await handleCreateContentSection(chatId, text, token);
    return;
  }

  // ===== معالجة تعديل اسم العنصر =====
  if (adminState.currentAction === 'edit_element' && adminState.step === 'waiting_new_name') {
    await handleEditElementName(chatId, text, token);
    return;
  }

  // ===== معالجة تعديل محتوى الزر =====
  if (adminState.currentAction === 'edit_button' && adminState.step === 'waiting_new_content') {
    await handleEditButtonContent(chatId, text, token);
    return;
  }

  // ===== معالجة إضافة محتوى =====
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content_title') {
    adminState.tempData.currentTitle = text;
    adminState.step = 'waiting_content_body';
    await sendMessage(chatId, 
      `📝 أدخل محتوى "${text}":\n(يمكنك إرسال نص أو فيديو أو صورة)`,
      token,
      { 
        reply_markup: { 
          keyboard: [
            ['✅ حفظ الكل'],
            ['🔙 إلغاء']
          ], 
          resize_keyboard: true 
        }
      }
    );
    return;
  }

  // ===== معالجة حفظ محتوى نصي =====
  if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content_body') {
    await handleAddContentItems(chatId, text, token);
    return;
  }

  // ===== حفظ الكل =====
  if (text === '✅ حفظ الكل' && adminState.currentAction === 'add_content') {
    await saveContentItems(chatId, token);
    return;
  }

  // ===== معالجة تعديل محتوى =====
  if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_edit_title') {
    adminState.tempData.oldTitle = text;
    adminState.step = 'waiting_edit_content';
    await sendMessage(chatId, 
      `✏️ أدخل المحتوى الجديد:`,
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

  if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_edit_content') {
    await handleEditContentItem(chatId, text, token);
    return;
  }

  // ===== تعديل اسم قسم المحتوى =====
  if (adminState.currentAction === 'edit_content_section_name' && adminState.step === 'waiting_new_name') {
    await handleEditContentSectionName(chatId, text, token);
    return;
  }

  // ===== إلغاء =====
  if (text === '🔙 إلغاء') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
    return;
  }

  // ===== أي شيء آخر =====
  await sendMessage(chatId, '⚠️ خيار غير معروف. استخدم الأزرار.', token);
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
// ========== إدارة الواجهة الرئيسية ==========
// ====================================================================

async function showInterfaceManagement(chatId, token) {
  const folders = Object.values(mainInterface.structure).filter(c => c.type === 'folder').length;
  const sections = Object.values(mainInterface.structure).filter(c => c.type === 'section').length;
  const buttons = Object.values(mainInterface.structure).filter(c => c.type === 'button').length;
  
  const message = `🎯 إدارة الواجهة الرئيسية

📊 إحصائيات العناصر:
• 📁 مجلدات: ${folders}
• 📂 أقسام: ${sections}
• 🔘 أزرار: ${buttons}
• 📌 مجموع: ${Object.keys(mainInterface.structure).length}

🔹 إنشاء:
• 📁 مجلد جديد
• 📂 قسم جديد
• 🔘 زر جديد

🔸 إدارة:
• ✏️ تعديل عنصر
• 🗑️ حذف عنصر
• 📊 ترتيب العناصر
• 📂 نقل قسم لمجلد`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📂 إنشاء قسم', '🔘 إنشاء زر'],
        ['✏️ تعديل عنصر', '🗑️ حذف عنصر', '📊 ترتيب العناصر'],
        ['📂 نقل قسم لمجلد', '🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

// ========== إنشاء مجلد ==========

async function handleCreateFolder(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح:', token);
    return;
  }

  if (mainInterface.structure[text]) {
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  mainInterface.structure[text] = { 
    type: 'folder', 
    children: [],
    created: new Date().toLocaleString('ar-EG')
  };
  mainInterface.order.push(text);

  await sendMessage(chatId, `✅ تم إنشاء المجلد "${text}" بنجاح!`, token);
  adminState.currentAction = null;
  adminState.step = null;
  await showInterfaceManagement(chatId, token);
}

// ========== إنشاء قسم ==========

async function handleCreateSection(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح:', token);
    return;
  }

  if (mainInterface.structure[text]) {
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  if (!contentSystem.sections[text]) {
    contentSystem.sections[text] = {
      title: text,
      items: [],
      settings: {},
      created: new Date().toLocaleString('ar-EG')
    };
  }

  mainInterface.structure[text] = { 
    type: 'section',
    contentId: text,
    created: new Date().toLocaleString('ar-EG')
  };
  mainInterface.order.push(text);

  await sendMessage(chatId, 
    `✅ تم إنشاء القسم "${text}" بنجاح!\n\n📝 يمكنك الآن إضافة محتوى له من قسم "إدارة المحتوى"`,
    token
  );
  
  adminState.currentAction = null;
  adminState.step = null;
  await showInterfaceManagement(chatId, token);
}

// ========== إنشاء زر ==========

async function handleSaveButton(chatId, text, token) {
  const name = adminState.tempData.buttonName;
  
  mainInterface.structure[name] = { 
    type: 'button', 
    content: text,
    created: new Date().toLocaleString('ar-EG')
  };
  mainInterface.order.push(name);

  await sendMessage(chatId, `✅ تم إنشاء الزر "${name}" بنجاح!`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showInterfaceManagement(chatId, token);
}

// ========== تعديل عنصر ==========

async function showEditElement(chatId, token) {
  const list = Object.keys(mainInterface.structure);
  if (list.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد عناصر للتعديل', token);
    return;
  }

  const buttons = list.map(name => {
    const type = mainInterface.structure[name].type;
    const icon = type === 'folder' ? '📁' : type === 'section' ? '📂' : '🔘';
    return [{ text: `✏️ ${icon} ${name}`, callback_data: `edit_element_${name}` }];
  });
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

  await sendMessage(chatId, '✏️ اختر العنصر للتعديل:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleEditElementName(chatId, text, token) {
  const oldName = adminState.tempData.oldName;
  const element = mainInterface.structure[oldName];
  
  if (!element) {
    await sendMessage(chatId, '⚠️ العنصر غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  if (mainInterface.structure[text] && text !== oldName) {
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  delete mainInterface.structure[oldName];
  mainInterface.structure[text] = element;
  
  const index = mainInterface.order.indexOf(oldName);
  if (index !== -1) mainInterface.order[index] = text;

  for (const key of Object.keys(mainInterface.structure)) {
    if (mainInterface.structure[key].type === 'folder') {
      const children = mainInterface.structure[key].children;
      const childIndex = children.indexOf(oldName);
      if (childIndex !== -1) {
        children[childIndex] = text;
      }
    }
  }

  await sendMessage(chatId, `✅ تم تعديل الاسم إلى "${text}"`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showInterfaceManagement(chatId, token);
}

async function handleEditButtonContent(chatId, text, token) {
  const name = adminState.tempData.buttonName;
  const element = mainInterface.structure[name];
  
  if (!element || element.type !== 'button') {
    await sendMessage(chatId, '⚠️ الزر غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  element.content = text;
  element.updated = new Date().toLocaleString('ar-EG');

  await sendMessage(chatId, `✅ تم تحديث محتوى الزر "${name}"`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showInterfaceManagement(chatId, token);
}

// ========== حذف عنصر ==========

async function showDeleteElement(chatId, token) {
  const list = Object.keys(mainInterface.structure);
  if (list.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد عناصر للحذف', token);
    return;
  }

  const buttons = list.map(name => {
    const type = mainInterface.structure[name].type;
    const icon = type === 'folder' ? '📁' : type === 'section' ? '📂' : '🔘';
    return [{ text: `🗑️ ${icon} ${name}`, callback_data: `delete_element_${name}` }];
  });
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

  await sendMessage(chatId, '🗑️ اختر العنصر للحذف:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== ترتيب العناصر ==========

async function showReorderElements(chatId, token) {
  if (mainInterface.order.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد عناصر لترتيبها', token);
    return;
  }

  let message = '📊 الترتيب الحالي:\n\n';
  mainInterface.order.forEach((name, index) => {
    const type = mainInterface.structure[name]?.type;
    const icon = type === 'folder' ? '📁' : type === 'section' ? '📂' : '🔘';
    message += `${index + 1}. ${icon} ${name}\n`;
  });

  message += '\n🔹 اختر عنصراً لنقله:';

  const buttons = mainInterface.order.map((name, index) => [
    { text: `${index + 1}. ${name}`, callback_data: `reorder_select_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== نقل قسم لمجلد ==========

async function showMoveSectionToFolder(chatId, token) {
  const sections = Object.keys(mainInterface.structure).filter(
    key => mainInterface.structure[key].type === 'section'
  );
  
  const folders = Object.keys(mainInterface.structure).filter(
    key => mainInterface.structure[key].type === 'folder'
  );

  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام لنقلها', token);
    return;
  }

  if (folders.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد مجلدات', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `move_section_select_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لنقله:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== إدارة المحتوى ==========
// ====================================================================

async function showContentManagementMain(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  const totalItems = sections.reduce((sum, key) => sum + (contentSystem.sections[key].items?.length || 0), 0);

  const message = `📝 إدارة المحتوى

📊 الإحصائيات:
• 📂 أقسام: ${sections.length}
• 📄 عناصر محتوى: ${totalItems}

🔹 إدارة الأقسام:
• 📂 إنشاء قسم محتوى جديد
• ✏️ تعديل قسم محتوى
• 🗑️ حذف قسم محتوى

🔸 إدارة المحتوى:
• ➕ إضافة محتوى
• ✏️ تعديل محتوى
• 🗑️ حذف محتوى
• 📊 ترتيب المحتوى
• 📋 نسخ محتوى`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📂 إنشاء قسم محتوى', '✏️ تعديل قسم محتوى', '🗑️ حذف قسم محتوى'],
        ['➕ إضافة محتوى', '✏️ تعديل محتوى', '🗑️ حذف محتوى'],
        ['📊 ترتيب المحتوى', '📋 نسخ محتوى'],
        ['🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

// ========== إنشاء قسم محتوى ==========

async function handleCreateContentSection(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح:', token);
    return;
  }

  if (contentSystem.sections[text]) {
    await sendMessage(chatId, '⚠️ هذا القسم موجود بالفعل!', token);
    return;
  }

  contentSystem.sections[text] = {
    title: text,
    items: [],
    settings: {
      allowComments: false,
      showDate: true
    },
    created: new Date().toLocaleString('ar-EG')
  };

  await sendMessage(chatId, `✅ تم إنشاء قسم المحتوى "${text}" بنجاح!`, token);
  adminState.currentAction = null;
  adminState.step = null;
  await showContentManagementMain(chatId, token);
}

// ========== تعديل وحذف قسم محتوى ==========

async function showEditContentSection(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `✏️ ${section}`, callback_data: `edit_content_section_name_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '✏️ اختر قسم المحتوى لتعديل اسمه:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleEditContentSectionName(chatId, text, token) {
  const oldName = adminState.tempData.oldName;
  
  if (!contentSystem.sections[oldName]) {
    await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  if (contentSystem.sections[text] && text !== oldName) {
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  contentSystem.sections[text] = contentSystem.sections[oldName];
  contentSystem.sections[text].title = text;
  delete contentSystem.sections[oldName];

  // تحديث في الواجهة إذا كان موجوداً
  if (mainInterface.structure[oldName] && mainInterface.structure[oldName].type === 'section') {
    mainInterface.structure[text] = mainInterface.structure[oldName];
    mainInterface.structure[text].contentId = text;
    delete mainInterface.structure[oldName];
    
    const index = mainInterface.order.indexOf(oldName);
    if (index !== -1) mainInterface.order[index] = text;
  }

  await sendMessage(chatId, `✅ تم تعديل اسم قسم المحتوى إلى "${text}"`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showContentManagementMain(chatId, token);
}

async function showDeleteContentSection(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `🗑️ ${section}`, callback_data: `delete_content_section_confirm_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '🗑️ اختر قسم المحتوى للحذف:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== إضافة محتوى ==========

async function showAddContent(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى! أنشئ قسم أولاً.', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `add_content_select_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لإضافة محتوى:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleAddContentItems(chatId, text, token) {
  if (text === '✅ حفظ الكل') {
    await saveContentItems(chatId, token);
    return;
  }

  if (text === '🔙 إلغاء') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showContentManagementMain(chatId, token);
    return;
  }

  if (!adminState.tempData.items) {
    adminState.tempData.items = [];
  }
  
  let contentType = 'text';
  let contentText = text;
  
  if (text && text.startsWith('http')) {
    if (text.includes('youtube') || text.includes('youtu.be') || text.includes('vimeo')) {
      contentType = 'video';
    } else if (text.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i)) {
      contentType = 'image';
    } else {
      contentType = 'link';
    }
  }
  
  adminState.tempData.items.push({
    id: Date.now() + Math.random(),
    title: adminState.tempData.currentTitle || 'بدون عنوان',
    content: contentText,
    type: contentType,
    created: new Date().toLocaleString('ar-EG')
  });

  await sendMessage(chatId, 
    `✅ تم إضافة "${adminState.tempData.currentTitle}"\n📝 أدخل عنوان التالي أو اضغط "حفظ الكل":`,
    token,
    { 
      reply_markup: { 
        keyboard: [
          ['✅ حفظ الكل'],
          ['🔙 إلغاء']
        ], 
        resize_keyboard: true 
      }
    }
  );
  
  adminState.step = 'waiting_content_title';
}

async function saveContentItems(chatId, token) {
  const sectionName = adminState.tempData.sectionName;
  const items = adminState.tempData.items || [];
  
  if (items.length === 0) {
    await sendMessage(chatId, '⚠️ لم يتم إضافة أي محتوى!', token);
    return;
  }

  if (!contentSystem.sections[sectionName]) {
    await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
    return;
  }

  if (!contentSystem.sections[sectionName].items) {
    contentSystem.sections[sectionName].items = [];
  }

  contentSystem.sections[sectionName].items.push(...items);

  await sendMessage(chatId, 
    `✅ تم حفظ ${items.length} محتوى في "${sectionName}"\n\n📌 يمكنك رؤيتها في واجهة المستخدم`,
    token
  );
  
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  
  await showContentManagementMain(chatId, token);
}

// ========== تعديل محتوى ==========

async function showEditContent(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `edit_content_section_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لتعديل محتواه:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleEditContentItem(chatId, text, token) {
  const sectionName = adminState.tempData.sectionName;
  const itemIndex = adminState.tempData.itemIndex;
  const section = contentSystem.sections[sectionName];
  
  if (!section || !section.items || !section.items[itemIndex]) {
    await sendMessage(chatId, '⚠️ المحتوى غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  section.items[itemIndex].content = text;
  section.items[itemIndex].updated = new Date().toLocaleString('ar-EG');
  
  await sendMessage(chatId, `✅ تم تحديث المحتوى بنجاح!`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showContentManagementMain(chatId, token);
}

// ========== حذف محتوى ==========

async function showDeleteContent(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `delete_content_section_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لحذف محتوى:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== ترتيب المحتوى ==========

async function showReorderContent(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `reorder_content_section_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لترتيب محتواه:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== نسخ محتوى ==========

async function showCopyContent(chatId, token) {
  const sections = Object.keys(contentSystem.sections);
  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام محتوى', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `copy_content_section_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, '📂 اختر القسم لنسخ محتوى:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== واجهة المستخدم ==========
// ====================================================================

async function showUserMainMenu(chatId, token, userId) {
  if (mainInterface.order.length === 0) {
    await sendMessage(chatId, '📌 البوت قيد الإعداد حالياً.', token);
    return;
  }

  if (userId) {
    userState[userId] = { currentPath: [] };
  }

  const buttons = [];
  for (const name of mainInterface.order) {
    const element = mainInterface.structure[name];
    if (!element) continue;
    
    const icon = element.type === 'folder' ? '📁' : element.type === 'section' ? '📂' : '🔘';
    buttons.push([`${icon} ${name}`]);
  }

  await sendMessage(chatId, '🎉 مرحباً! اختر ما تريد:', token, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

async function handleUserTextSelection(chatId, text, token, userId) {
  const cleanText = text.replace(/[📁📂🔘]/g, '').trim();

  if (text === '🔙 رجوع' || text === 'رجوع' || text === '🔙 القائمة الرئيسية') {
    if (userState[userId] && userState[userId].currentPath.length > 0) {
      userState[userId].currentPath.pop();
      const parentPath = userState[userId].currentPath;
      if (parentPath.length === 0) {
        await showUserMainMenu(chatId, token, userId);
      } else {
        const parentName = parentPath[parentPath.length - 1];
        await showFolderContent(chatId, parentName, token, userId);
      }
    } else {
      await showUserMainMenu(chatId, token, userId);
    }
    return;
  }

  for (const [name, element] of Object.entries(mainInterface.structure)) {
    if (name === cleanText) {
      if (element.type === 'folder') {
        await showFolderContent(chatId, name, token, userId);
        return;
      } else if (element.type === 'section') {
        await showSectionContent(chatId, name, token);
        return;
      } else if (element.type === 'button') {
        await sendMessage(chatId, element.content || '⚠️ هذا الزر فارغ', token, {
          parse_mode: 'HTML'
        });
        return;
      }
    }
  }

  await sendMessage(chatId, 'استخدم الأزرار للتنقل', token);
}

async function showFolderContent(chatId, folderName, token, userId) {
  const folder = mainInterface.structure[folderName];
  if (!folder || folder.type !== 'folder') {
    await sendMessage(chatId, '⚠️ هذا المجلد غير موجود', token);
    return;
  }

  if (userId) {
    if (!userState[userId]) {
      userState[userId] = { currentPath: [] };
    }
    if (!userState[userId].currentPath.includes(folderName)) {
      userState[userId].currentPath.push(folderName);
    }
  }

  const children = folder.children || [];
  
  if (children.length === 0) {
    const buttons = [
      ['🔙 رجوع'],
      ['🔙 القائمة الرئيسية']
    ];
    await sendMessage(chatId, `📁 "${folderName}" فارغ`, token, {
      reply_markup: { keyboard: buttons, resize_keyboard: true }
    });
    return;
  }

  const buttons = [];
  for (const child of children) {
    const childData = mainInterface.structure[child];
    if (!childData) continue;
    const icon = childData.type === 'section' ? '📂' : '🔘';
    buttons.push([`${icon} ${child}`]);
  }
  
  buttons.push(['🔙 رجوع']);
  buttons.push(['🔙 القائمة الرئيسية']);

  await sendMessage(chatId, `📁 محتويات "${folderName}":`, token, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

async function showSectionContent(chatId, sectionName, token) {
  const section = contentSystem.sections[sectionName];
  if (!section) {
    await sendMessage(chatId, '⚠️ هذا القسم غير موجود', token);
    return;
  }

  const items = section.items || [];

  if (items.length === 0) {
    await sendMessage(chatId, '📂 هذا القسم فارغ حالياً', token);
    return;
  }

  const buttons = items.map(item => {
    const icon = item.type === 'video' ? '🎬' : item.type === 'image' ? '🖼️' : '📄';
    return [{ text: `${icon} ${item.title}`, callback_data: `show_item_${sectionName}_${encodeURIComponent(item.id)}` }];
  });
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'back_to_menu' }]);

  await sendMessage(chatId, `📂 محتوى "${sectionName}":`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
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

  if (data === 'admin_interface_back') {
    await showInterfaceManagement(chatId, token);
    return;
  }

  if (data === 'admin_content_back') {
    await showContentManagementMain(chatId, token);
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

  // ===== إدارة الواجهة - تعديل =====
  if (data.startsWith('edit_element_')) {
    const name = data.replace('edit_element_', '');
    const element = mainInterface.structure[name];
    
    if (!element) {
      await sendMessage(chatId, '⚠️ العنصر غير موجود!', token);
      return;
    }

    const buttons = [
      [{ text: '✏️ تغيير الاسم', callback_data: `edit_name_${name}` }]
    ];

    if (element.type === 'button') {
      buttons.push([{ text: '✏️ تعديل المحتوى', callback_data: `edit_button_content_${name}` }]);
    }

    if (element.type === 'section') {
      buttons.push([{ text: '📝 إدارة المحتوى', callback_data: `manage_content_${name}` }]);
    }

    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

    await sendMessage(chatId, `✏️ تعديل "${name}"\nنوع: ${element.type}`, token, {
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (data.startsWith('edit_name_')) {
    const name = data.replace('edit_name_', '');
    adminState.currentAction = 'edit_element';
    adminState.step = 'waiting_new_name';
    adminState.tempData.oldName = name;
    
    await sendMessage(chatId, `✏️ أدخل الاسم الجديد لـ "${name}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  if (data.startsWith('edit_button_content_')) {
    const name = data.replace('edit_button_content_', '');
    adminState.currentAction = 'edit_button';
    adminState.step = 'waiting_new_content';
    adminState.tempData.buttonName = name;
    
    await sendMessage(chatId, `✏️ أدخل المحتوى الجديد للزر "${name}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  // ===== إدارة الواجهة - حذف =====
  if (data.startsWith('delete_element_')) {
    const name = data.replace('delete_element_', '');
    const element = mainInterface.structure[name];
    
    if (!element) {
      await sendMessage(chatId, '⚠️ العنصر غير موجود!', token);
      return;
    }

    const buttons = [
      [
        { text: '✅ نعم، احذف', callback_data: `delete_confirm_${name}` },
        { text: '❌ إلغاء', callback_data: 'admin_interface_back' }
      ]
    ];

    await sendMessage(chatId, 
      `⚠️ هل أنت متأكد من حذف "${name}"؟\nنوع: ${element.type}`,
      token,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('delete_confirm_')) {
    const name = data.replace('delete_confirm_', '');
    
    delete mainInterface.structure[name];
    const index = mainInterface.order.indexOf(name);
    if (index !== -1) mainInterface.order.splice(index, 1);

    for (const key of Object.keys(mainInterface.structure)) {
      if (mainInterface.structure[key].type === 'folder') {
        const children = mainInterface.structure[key].children;
        const childIndex = children.indexOf(name);
        if (childIndex !== -1) children.splice(childIndex, 1);
      }
    }

    await sendMessage(chatId, `✅ تم حذف "${name}"`, token);
    await showInterfaceManagement(chatId, token);
    return;
  }

  // ===== إدارة الواجهة - ترتيب =====
  if (data.startsWith('reorder_select_')) {
    const index = parseInt(data.replace('reorder_select_', ''));
    adminState.tempData.reorderIndex = index;
    
    const buttons = [];
    for (let i = 0; i < mainInterface.order.length; i++) {
      if (i !== index) {
        buttons.push([
          { text: `⬆️ نقل إلى ${i + 1}`, callback_data: `reorder_move_${index}_${i}` }
        ]);
      }
    }
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

    await sendMessage(chatId, 
      `📊 اختر الموقع الجديد لـ "${mainInterface.order[index]}":`,
      token,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('reorder_move_')) {
    const parts = data.split('_');
    const from = parseInt(parts[2]);
    const to = parseInt(parts[3]);
    
    const item = mainInterface.order.splice(from, 1)[0];
    mainInterface.order.splice(to, 0, item);

    await sendMessage(chatId, `✅ تم تحديث الترتيب`, token);
    await showInterfaceManagement(chatId, token);
    return;
  }

  // ===== إدارة الواجهة - نقل قسم لمجلد =====
  if (data.startsWith('move_section_select_')) {
    const sectionName = data.replace('move_section_select_', '');
    adminState.tempData.sectionToMove = sectionName;
    
    const folders = Object.keys(mainInterface.structure).filter(
      key => mainInterface.structure[key].type === 'folder'
    );

    const buttons = folders.map(folder => [
      { text: `📁 ${folder}`, callback_data: `move_section_${sectionName}_${folder}` }
    ]);
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

    await sendMessage(chatId, `📂 اختر المجلد لنقل "${sectionName}":`, token, {
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (data.startsWith('move_section_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const folderName = parts[3];
    
    if (mainInterface.structure[folderName] && mainInterface.structure[folderName].type === 'folder') {
      const index = mainInterface.order.indexOf(sectionName);
      if (index !== -1) {
        mainInterface.order.splice(index, 1);
      }
      
      if (!mainInterface.structure[folderName].children.includes(sectionName)) {
        mainInterface.structure[folderName].children.push(sectionName);
      }
      
      await sendMessage(chatId, `✅ تم نقل "${sectionName}" إلى مجلد "${folderName}"`, token);
      await showInterfaceManagement(chatId, token);
    }
    return;
  }

  // ===== إدارة المحتوى =====
  if (data.startsWith('add_content_select_')) {
    const sectionName = data.replace('add_content_select_', '');
    adminState.currentAction = 'add_content';
    adminState.step = 'waiting_content_title';
    adminState.tempData.sectionName = sectionName;
    adminState.tempData.items = [];
    
    await sendMessage(chatId, 
      `📝 أدخل عنوان المحتوى الأول لـ "${sectionName}":`,
      token,
      { reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true } }
    );
    return;
  }

  if (data.startsWith('edit_content_section_')) {
    const sectionName = data.replace('edit_content_section_', '');
    await showEditContentItems(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('edit_content_section_name_')) {
    const sectionName = data.replace('edit_content_section_name_', '');
    adminState.currentAction = 'edit_content_section_name';
    adminState.step = 'waiting_new_name';
    adminState.tempData.oldName = sectionName;
    
    await sendMessage(chatId, `✏️ أدخل الاسم الجديد لقسم المحتوى "${sectionName}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  if (data.startsWith('delete_content_section_confirm_')) {
    const sectionName = data.replace('delete_content_section_confirm_', '');
    
    // حذف من نظام المحتوى
    if (contentSystem.sections[sectionName]) {
      delete contentSystem.sections[sectionName];
    }
    
    // حذف من الواجهة إذا كان موجوداً
    if (mainInterface.structure[sectionName] && mainInterface.structure[sectionName].type === 'section') {
      delete mainInterface.structure[sectionName];
      const index = mainInterface.order.indexOf(sectionName);
      if (index !== -1) mainInterface.order.splice(index, 1);
    }
    
    await sendMessage(chatId, `✅ تم حذف قسم المحتوى "${sectionName}"`, token);
    await showContentManagementMain(chatId, token);
    return;
  }

  if (data.startsWith('edit_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const itemIndex = parseInt(parts[3]);
    
    adminState.currentAction = 'edit_content';
    adminState.step = 'waiting_edit_title';
    adminState.tempData.sectionName = sectionName;
    adminState.tempData.itemIndex = itemIndex;
    
    const section = contentSystem.sections[sectionName];
    if (section && section.items && section.items[itemIndex]) {
      await sendMessage(chatId, 
        `✏️ أدخل العنوان الجديد (كان: ${section.items[itemIndex].title}):`,
        token,
        { reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true } }
      );
    }
    return;
  }

  if (data.startsWith('delete_content_section_')) {
    const sectionName = data.replace('delete_content_section_', '');
    await showDeleteContentItems(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('delete_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const itemIndex = parseInt(parts[3]);
    
    const section = contentSystem.sections[sectionName];
    if (section && section.items) {
      section.items.splice(itemIndex, 1);
      await sendMessage(chatId, `✅ تم حذف المحتوى`, token);
      await showContentManagementMain(chatId, token);
    }
    return;
  }

  if (data.startsWith('reorder_content_section_')) {
    const sectionName = data.replace('reorder_content_section_', '');
    await showReorderContentItems(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('content_reorder_select_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const fromIndex = parseInt(parts[4]);
    
    const section = contentSystem.sections[sectionName];
    if (!section || !section.items) {
      await sendMessage(chatId, '⚠️ القسم غير موجود', token);
      return;
    }

    const buttons = [];
    for (let i = 0; i < section.items.length; i++) {
      if (i !== fromIndex) {
        buttons.push([
          { text: `⬆️ نقل إلى ${i + 1}`, callback_data: `content_reorder_move_${sectionName}_${fromIndex}_${i}` }
        ]);
      }
    }
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

    await sendMessage(chatId, 
      `📊 اختر الموقع الجديد لـ "${section.items[fromIndex].title}":`,
      token,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('content_reorder_move_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const from = parseInt(parts[4]);
    const to = parseInt(parts[5]);
    
    const section = contentSystem.sections[sectionName];
    if (section && section.items) {
      const item = section.items.splice(from, 1)[0];
      section.items.splice(to, 0, item);
      await sendMessage(chatId, `✅ تم تحديث ترتيب المحتوى`, token);
      await showContentManagementMain(chatId, token);
    }
    return;
  }

  if (data.startsWith('copy_content_section_')) {
    const sectionName = data.replace('copy_content_section_', '');
    await showCopyContentItems(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('copy_item_select_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const itemIndex = parseInt(parts[4]);
    
    const section = contentSystem.sections[sectionName];
    if (!section || !section.items || !section.items[itemIndex]) {
      await sendMessage(chatId, '⚠️ المحتوى غير موجود', token);
      return;
    }

    const item = section.items[itemIndex];
    const targetSections = Object.keys(contentSystem.sections).filter(s => s !== sectionName);
    
    if (targetSections.length === 0) {
      await sendMessage(chatId, '⚠️ لا توجد أقسام أخرى', token);
      return;
    }

    const buttons = targetSections.map(target => [
      { text: `📂 ${target}`, callback_data: `copy_item_to_${sectionName}_${itemIndex}_${target}` }
    ]);
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

    await sendMessage(chatId, `📋 اختر الوجهة لنسخ "${item.title}":`, token, {
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (data.startsWith('copy_item_to_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const itemIndex = parseInt(parts[4]);
    const targetSection = parts[5];
    
    const sourceSection = contentSystem.sections[sectionName];
    const destSection = contentSystem.sections[targetSection];
    
    if (!sourceSection || !destSection || !sourceSection.items || !sourceSection.items[itemIndex]) {
      await sendMessage(chatId, '⚠️ البيانات غير صالحة', token);
      return;
    }

    const item = JSON.parse(JSON.stringify(sourceSection.items[itemIndex]));
    item.id = Date.now() + Math.random();
    item.copied_from = sectionName;
    item.copied_at = new Date().toLocaleString('ar-EG');
    
    if (!destSection.items) {
      destSection.items = [];
    }
    destSection.items.push(item);

    await sendMessage(chatId, `✅ تم نسخ "${item.title}" إلى "${targetSection}"`, token);
    await showContentManagementMain(chatId, token);
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

// ========== وظائف إدارة المحتوى المساعدة ==========

async function showEditContentItems(chatId, sectionName, token) {
  const section = contentSystem.sections[sectionName];
  if (!section || !section.items || section.items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لتعديله', token);
    return;
  }

  const buttons = section.items.map((item, index) => [
    { text: `✏️ ${item.title}`, callback_data: `edit_item_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, `✏️ اختر المحتوى لتعديله في "${sectionName}":`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showDeleteContentItems(chatId, sectionName, token) {
  const section = contentSystem.sections[sectionName];
  if (!section || !section.items || section.items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لحذفه', token);
    return;
  }

  const buttons = section.items.map((item, index) => [
    { text: `🗑️ ${item.title}`, callback_data: `delete_item_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, `🗑️ اختر المحتوى للحذف من "${sectionName}":`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showReorderContentItems(chatId, sectionName, token) {
  const section = contentSystem.sections[sectionName];
  if (!section || !section.items || section.items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لترتيبه', token);
    return;
  }

  let message = `📊 ترتيب محتوى "${sectionName}":\n\n`;
  section.items.forEach((item, index) => {
    message += `${index + 1}. ${item.title}\n`;
  });

  message += '\n🔹 اختر عنصراً لنقله:';

  const buttons = section.items.map((item, index) => [
    { text: `${index + 1}. ${item.title}`, callback_data: `content_reorder_select_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showCopyContentItems(chatId, sectionName, token) {
  const section = contentSystem.sections[sectionName];
  if (!section || !section.items || section.items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لنسخه', token);
    return;
  }

  const targetSections = Object.keys(contentSystem.sections).filter(s => s !== sectionName);
  if (targetSections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام أخرى للنسخ إليها', token);
    return;
  }

  const buttons = section.items.map((item, index) => [
    { text: `📋 ${item.title}`, callback_data: `copy_item_select_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_content_back' }]);

  await sendMessage(chatId, `📋 اختر المحتوى لنسخه من "${sectionName}":`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ====================================================================
// ========== معالجة كولباك المستخدم ==========
// ====================================================================

async function handleUserCallback(data, chatId, token, userId) {
  if (data === 'back_to_menu') {
    if (userState[userId]) {
      userState[userId].currentPath = [];
    }
    await showUserMainMenu(chatId, token, userId);
    return;
  }

  if (data.startsWith('show_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const itemId = decodeURIComponent(parts.slice(3).join('_'));
    
    const section = contentSystem.sections[sectionName];
    if (!section) {
      await sendMessage(chatId, '⚠️ القسم غير موجود', token);
      return;
    }

    const item = section.items.find(i => i.id == itemId);
    if (item) {
      let content = item.content;
      if (item.type === 'video') {
        content = `🎬 ${item.title}\n\n${content}`;
      } else if (item.type === 'image') {
        content = `🖼️ ${item.title}\n\n${content}`;
      } else if (item.type === 'animation') {
        content = `🎞️ ${item.title}\n\n${content}`;
      }
      await sendMessage(chatId, content || '⚠️ هذا المحتوى فارغ', token, {
        parse_mode: 'HTML'
      });
    } else {
      await sendMessage(chatId, '⚠️ المحتوى غير موجود', token);
    }
    return;
  }
}

// ====================================================================
// ========== دوال مساعدة إضافية ==========
// ====================================================================

async function showStatistics(chatId, token) {
  const stats = `📊 الإحصائيات العامة:

👥 المستخدمين:
• ✅ معتمدين: ${Object.keys(approvedUsers).length}
• ⏳ معلق: ${Object.keys(pendingUsers).length}
• ❌ مرفوض: ${Object.keys(rejectedUsers).length}

🎯 الواجهة:
• 📁 مجلدات: ${Object.values(mainInterface.structure).filter(c => c.type === 'folder').length}
• 📂 أقسام: ${Object.values(mainInterface.structure).filter(c => c.type === 'section').length}
• 🔘 أزرار: ${Object.values(mainInterface.structure).filter(c => c.type === 'button').length}
• 📌 مجموع: ${Object.keys(mainInterface.structure).length}

📝 المحتوى:
• 📂 أقسام محتوى: ${Object.keys(contentSystem.sections).length}
• 📄 عناصر: ${Object.values(contentSystem.sections).reduce((sum, s) => sum + (s.items?.length || 0), 0)}

⏱️ آخر تحديث: ${new Date().toLocaleString('ar-EG')}`;

  await sendMessage(chatId, stats, token, {
    reply_markup: { keyboard: [['🔙 العودة']], resize_keyboard: true }
  });
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
