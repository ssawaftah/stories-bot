// ========== التخزين المؤقت ==========
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// ========== نظام إدارة الواجهة الرئيسية ==========
const mainInterface = {
  structure: {},    // تخزين المجلدات والأقسام والأزرار
  order: [],        // ترتيب العناصر في الواجهة الرئيسية
  content: {}       // تخزين محتوى الأقسام (عناوين ومحتوى)
};

// ========== حالة الأدمن ==========
const adminState = {
  currentAction: null,
  step: null,
  tempData: {},
  editingTarget: null
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

// ========== دوال واجهة الأدمن ==========

async function showAdminMainMenu(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  const approvedCount = Object.keys(approvedUsers).length;
  const interfaceCount = Object.keys(mainInterface.structure).length;

  const message = `👋 مرحباً بك في لوحة التحكم

📊 الإحصائيات:
• 📋 طلبات جديدة: ${pendingCount}
• ❌ مرفوضين: ${rejectedCount}
• ✅ معتمدين: ${approvedCount}
• 📂 عناصر الواجهة: ${interfaceCount}

📌 اختر الإجراء المناسب:`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📋 إدارة الطلبات', '🎯 إدارة الواجهة'],
        ['📊 الإحصائيات', '📢 إرسال إشعار'],
        ['🔙 العودة']
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
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showAdminMainMenu(chatId, token);
      break;
      
    case '🔙 إلغاء':
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showAdminMainMenu(chatId, token);
      break;
      
    default:
      await handleAdminInterfaceActions(chatId, text, token);
      break;
  }
}

// ========== إدارة الطلبات ==========

async function showRequestsManagement(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  
  if (pendingList.length === 0) {
    await sendMessage(chatId, '📋 لا توجد طلبات جديدة', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  let message = '📋 الطلبات الجديدة:\n\n';
  const buttons = [];
  
  for (const user of pendingList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n─────────────────\n`;
    buttons.push([
      { text: `✅ قبول ${user.name}`, callback_data: `approve_${user.id}` },
      { text: `❌ رفض`, callback_data: `reject_${user.id}` }
    ]);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== إدارة الواجهة الرئيسية ==========

async function showInterfaceManagement(chatId, token) {
  const folders = Object.values(mainInterface.structure).filter(c => c.type === 'folder').length;
  const sections = Object.values(mainInterface.structure).filter(c => c.type === 'section').length;
  const buttons = Object.values(mainInterface.structure).filter(c => c.type === 'button').length;
  
  const message = `🎯 إدارة الواجهة الرئيسية

📊 الإحصائيات:
• 📁 مجلدات: ${folders}
• 📂 أقسام: ${sections}
• 🔘 أزرار: ${buttons}
• 📌 مجموع: ${Object.keys(mainInterface.structure).length}

🔹 إنشاء عنصر جديد:
• 📁 مجلد جديد
• 📂 قسم جديد
• 🔘 زر جديد

🔸 إدارة العناصر:
• ✏️ تعديل عنصر
• 🗑️ حذف عنصر
• 📊 ترتيب العناصر
• 📂 نقل قسم لمجلد

📝 إدارة المحتوى:
• ➕ إضافة محتوى
• ✏️ تعديل محتوى
• 🗑️ حذف محتوى`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📂 إنشاء قسم', '🔘 إنشاء زر'],
        ['✏️ تعديل عنصر', '🗑️ حذف عنصر', '📊 ترتيب العناصر'],
        ['📂 نقل قسم لمجلد', '➕ إدارة المحتوى'],
        ['🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminInterfaceActions(chatId, text, token) {
  // ===== إنشاء مجلد =====
  if (text === '📁 إنشاء مجلد') {
    adminState.currentAction = 'create_folder';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📁 أدخل اسم المجلد الجديد:', token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  // ===== إنشاء قسم =====
  if (text === '📂 إنشاء قسم') {
    adminState.currentAction = 'create_section';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📂 أدخل اسم القسم الجديد:', token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  // ===== إنشاء زر =====
  if (text === '🔘 إنشاء زر') {
    adminState.currentAction = 'create_button';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '🔘 أدخل اسم الزر الجديد:', token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
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

  // ===== إدارة المحتوى =====
  if (text === '➕ إدارة المحتوى') {
    await showContentManagement(chatId, token);
    return;
  }

  // ===== معالجة إنشاء العناصر =====
  if (adminState.currentAction === 'create_folder' && adminState.step === 'waiting_name') {
    await handleCreateFolder(chatId, text, token);
  } else if (adminState.currentAction === 'create_section' && adminState.step === 'waiting_name') {
    adminState.tempData.name = text;
    adminState.step = 'waiting_content';
    await sendMessage(chatId, `📝 أدخل محتوى القسم "${text}":\n(يمكنك إرسال نص أو فيديو أو صورة)`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
  } else if (adminState.currentAction === 'create_button' && adminState.step === 'waiting_name') {
    adminState.tempData.name = text;
    adminState.step = 'waiting_content';
    await sendMessage(chatId, `🔘 أدخل محتوى الزر "${text}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
  } else if (adminState.currentAction === 'create_section' && adminState.step === 'waiting_content') {
    await handleCreateSectionContent(chatId, text, token);
  } else if (adminState.currentAction === 'create_button' && adminState.step === 'waiting_content') {
    await handleCreateButtonContent(chatId, text, token);
  } else if (adminState.currentAction === 'edit_element' && adminState.step === 'waiting_new_name') {
    await handleEditElementName(chatId, text, token);
  } else if (adminState.currentAction === 'edit_content' && adminState.step === 'waiting_new_content') {
    await handleEditContent(chatId, text, token);
  } else if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_title') {
    adminState.tempData.title = text;
    adminState.step = 'waiting_content_item';
    await sendMessage(chatId, `📝 أرسل محتوى "${text}":\n(نص أو فيديو أو صورة)`, token, {
      reply_markup: { 
        keyboard: [
          ['✅ تم الانتهاء'],
          ['🔙 إلغاء']
        ], 
        resize_keyboard: true 
      }
    });
  } else if (adminState.currentAction === 'add_content' && adminState.step === 'waiting_content_item') {
    await handleAddContentItem(chatId, text, token);
  } else if (text === '✅ تم الانتهاء' && adminState.currentAction === 'add_content') {
    await finishAddingContent(chatId, token);
  } else if (text === '🔙 إلغاء') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
  } else {
    await sendMessage(chatId, '⚠️ خيار غير معروف', token);
  }
}

// ========== إنشاء العناصر ==========

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

async function handleCreateSectionContent(chatId, text, token) {
  const name = adminState.tempData.name;
  
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال محتوى:', token);
    return;
  }

  mainInterface.structure[name] = { 
    type: 'section', 
    content: text,
    items: [],
    created: new Date().toLocaleString('ar-EG')
  };
  mainInterface.order.push(name);

  // عرض خيار نقل لمجلد
  const folders = Object.keys(mainInterface.structure).filter(
    key => mainInterface.structure[key].type === 'folder'
  );

  if (folders.length > 0) {
    const buttons = folders.map(folder => [
      { text: `📁 ${folder}`, callback_data: `move_section_${name}_${folder}` }
    ]);
    buttons.push([{ text: '🚫 عدم النقل', callback_data: `skip_move_${name}` }]);

    await sendMessage(chatId, 
      `✅ تم إنشاء القسم "${name}"!\n📌 هل تريد نقله لمجلد؟`,
      token,
      { reply_markup: { inline_keyboard: buttons } }
    );
  } else {
    await sendMessage(chatId, `✅ تم إنشاء القسم "${name}"`, token);
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showInterfaceManagement(chatId, token);
  }
}

async function handleCreateButtonContent(chatId, text, token) {
  const name = adminState.tempData.name;
  
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال محتوى:', token);
    return;
  }

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

// ========== تعديل العناصر ==========

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

  // تحديث في المجلدات
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

// ========== حذف العناصر ==========

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
    await sendMessage(chatId, '⚠️ لا توجد مجلدات لنقل الأقسام إليها', token);
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

// ========== إدارة المحتوى ==========

async function showContentManagement(chatId, token) {
  const sections = Object.keys(mainInterface.structure).filter(
    key => mainInterface.structure[key].type === 'section'
  );

  if (sections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام لإدارة محتواها', token);
    return;
  }

  const buttons = sections.map(section => [
    { text: `📂 ${section}`, callback_data: `manage_content_${section}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]);

  await sendMessage(chatId, '📝 اختر القسم لإدارة محتواه:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showSectionContentManagement(chatId, sectionName, token) {
  const section = mainInterface.structure[sectionName];
  if (!section || section.type !== 'section') {
    await sendMessage(chatId, '⚠️ القسم غير موجود', token);
    return;
  }

  const items = section.items || [];
  let message = `📂 إدارة محتوى "${sectionName}"\n\n`;
  message += `📊 عدد العناصر: ${items.length}\n\n`;

  if (items.length > 0) {
    message += '📋 العناصر:\n';
    items.forEach((item, index) => {
      message += `${index + 1}. ${item.title}\n`;
    });
  }

  const buttons = [
    [{ text: '➕ إضافة محتوى', callback_data: `add_content_${sectionName}` }],
    [{ text: '✏️ تعديل محتوى', callback_data: `edit_content_list_${sectionName}` }],
    [{ text: '🗑️ حذف محتوى', callback_data: `delete_content_list_${sectionName}` }],
    [{ text: '🔙 رجوع', callback_data: 'admin_interface_back' }]
  ];

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== إضافة محتوى ==========

async function handleAddContent(chatId, sectionName, token) {
  adminState.currentAction = 'add_content';
  adminState.step = 'waiting_title';
  adminState.tempData.sectionName = sectionName;
  adminState.tempData.contentItems = [];

  await sendMessage(chatId, `📝 أدخل عنوان المحتوى الجديد للقسم "${sectionName}":`, token, {
    reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
  });
}

async function handleAddContentItem(chatId, text, token) {
  if (text === '✅ تم الانتهاء') {
    await finishAddingContent(chatId, token);
    return;
  }

  if (text === '🔙 إلغاء') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
    return;
  }

  // حفظ المحتوى المؤقت
  if (!adminState.tempData.contentItems) {
    adminState.tempData.contentItems = [];
  }
  
  adminState.tempData.contentItems.push({
    title: adminState.tempData.title || 'بدون عنوان',
    content: text
  });

  await sendMessage(chatId, `✅ تم إضافة المحتوى!\n📝 أرسل المحتوى التالي أو اضغط "تم الانتهاء":`, token, {
    reply_markup: { 
      keyboard: [
        ['✅ تم الانتهاء'],
        ['🔙 إلغاء']
      ], 
      resize_keyboard: true 
    }
  });
}

async function finishAddingContent(chatId, token) {
  const sectionName = adminState.tempData.sectionName;
  const section = mainInterface.structure[sectionName];
  
  if (!section || section.type !== 'section') {
    await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  if (!section.items) {
    section.items = [];
  }

  const items = adminState.tempData.contentItems || [];
  if (items.length === 0) {
    await sendMessage(chatId, '⚠️ لم يتم إضافة أي محتوى!', token);
    return;
  }

  section.items.push(...items);

  await sendMessage(chatId, `✅ تم إضافة ${items.length} محتوى إلى "${sectionName}"`, token);
  
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showSectionContentManagement(chatId, sectionName, token);
}

// ========== عرض واجهة المستخدم ==========

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

// ========== معالجة اختيارات المستخدم ==========

async function handleUserTextSelection(chatId, text, token, userId) {
  // إزالة الإيموجي من النص
  const cleanText = text.replace(/[📁📂🔘]/g, '').trim();

  // معالجة الرجوع
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

  // البحث في العناصر
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

// ========== عرض محتويات المجلد ==========

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

// ========== عرض محتوى القسم ==========

async function showSectionContent(chatId, sectionName, token) {
  const section = mainInterface.structure[sectionName];
  if (!section || section.type !== 'section') {
    await sendMessage(chatId, '⚠️ هذا القسم غير موجود', token);
    return;
  }

  const items = section.items || [];
  const content = section.content || '';

  if (content) {
    await sendMessage(chatId, content, token, { parse_mode: 'HTML' });
  }

  if (items.length === 0) {
    await sendMessage(chatId, '📂 هذا القسم فارغ حالياً', token);
    return;
  }

  const buttons = items.map(item => [
    { text: `📄 ${item.title}`, callback_data: `show_item_${sectionName}_${encodeURIComponent(item.title)}` }
  ]);
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'back_to_menu' }]);

  await sendMessage(chatId, `📂 محتوى "${sectionName}":`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== معالجة كولباك المستخدم ==========

async function handleUserCallback(data, chatId, token, userId) {
  if (data === 'back_to_menu') {
    if (userState[userId]) {
      userState[userId].currentPath = [];
    }
    await showUserMainMenu(chatId, token, userId);
    return;
  }

  // عرض محتوى عنصر
  if (data.startsWith('show_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const title = decodeURIComponent(parts.slice(3).join('_'));
    
    const section = mainInterface.structure[sectionName];
    if (!section || section.type !== 'section') {
      await sendMessage(chatId, '⚠️ القسم غير موجود', token);
      return;
    }

    const items = section.items || [];
    const item = items.find(i => i.title === title);
    
    if (item) {
      await sendMessage(chatId, item.content || '⚠️ هذا المحتوى فارغ', token, {
        parse_mode: 'HTML'
      });
    } else {
      await sendMessage(chatId, '⚠️ المحتوى غير موجود', token);
    }
    return;
  }

  // فتح مجلد من كولباك
  if (data.startsWith('open_folder_')) {
    const folderName = data.replace('open_folder_', '');
    await showFolderContent(chatId, folderName, token, userId);
    return;
  }
}

// ========== معالجة كولباك الأدمن ==========

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

  // ===== نقل قسم لمجلد =====
  if (data.startsWith('move_section_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const folderName = parts[3];
    
    if (mainInterface.structure[folderName] && mainInterface.structure[folderName].type === 'folder') {
      // إزالة من القائمة الرئيسية
      const index = mainInterface.order.indexOf(sectionName);
      if (index !== -1) {
        mainInterface.order.splice(index, 1);
      }
      
      // إضافة للمجلد
      if (!mainInterface.structure[folderName].children.includes(sectionName)) {
        mainInterface.structure[folderName].children.push(sectionName);
      }
      
      await sendMessage(chatId, `✅ تم نقل "${sectionName}" إلى مجلد "${folderName}"`, token);
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showInterfaceManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('skip_move_')) {
    const sectionName = data.split('_')[2];
    await sendMessage(chatId, `✅ تم إنشاء القسم "${sectionName}" في القائمة الرئيسية`, token);
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showInterfaceManagement(chatId, token);
    return;
  }

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

  // ===== تعديل عنصر =====
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

    if (element.type === 'section') {
      buttons.push([{ text: '✏️ تعديل المحتوى', callback_data: `edit_section_content_${name}` }]);
    } else if (element.type === 'button') {
      buttons.push([{ text: '✏️ تعديل المحتوى', callback_data: `edit_button_content_${name}` }]);
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

  if (data.startsWith('edit_section_content_')) {
    const name = data.replace('edit_section_content_', '');
    adminState.currentAction = 'edit_content';
    adminState.step = 'waiting_new_content';
    adminState.tempData.name = name;
    adminState.tempData.type = 'section';
    
    await sendMessage(chatId, `✏️ أدخل المحتوى الجديد للقسم "${name}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  if (data.startsWith('edit_button_content_')) {
    const name = data.replace('edit_button_content_', '');
    adminState.currentAction = 'edit_content';
    adminState.step = 'waiting_new_content';
    adminState.tempData.name = name;
    adminState.tempData.type = 'button';
    
    await sendMessage(chatId, `✏️ أدخل المحتوى الجديد للزر "${name}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  // ===== حذف عنصر =====
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

    // حذف من المجلدات
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

  // ===== ترتيب العناصر =====
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

  // ===== إدارة المحتوى =====
  if (data.startsWith('manage_content_')) {
    const sectionName = data.replace('manage_content_', '');
    await showSectionContentManagement(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('add_content_')) {
    const sectionName = data.replace('add_content_', '');
    await handleAddContent(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('edit_content_list_')) {
    const sectionName = data.replace('edit_content_list_', '');
    await showEditContentList(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('delete_content_list_')) {
    const sectionName = data.replace('delete_content_list_', '');
    await showDeleteContentList(chatId, sectionName, token);
    return;
  }

  if (data.startsWith('edit_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const itemIndex = parseInt(parts[3]);
    
    adminState.currentAction = 'edit_content_item';
    adminState.step = 'waiting_new_title';
    adminState.tempData.sectionName = sectionName;
    adminState.tempData.itemIndex = itemIndex;
    
    await sendMessage(chatId, `✏️ أدخل العنوان الجديد:`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  if (data.startsWith('delete_item_')) {
    const parts = data.split('_');
    const sectionName = parts[2];
    const itemIndex = parseInt(parts[3]);
    
    const section = mainInterface.structure[sectionName];
    if (section && section.items) {
      section.items.splice(itemIndex, 1);
      await sendMessage(chatId, `✅ تم حذف المحتوى`, token);
      await showSectionContentManagement(chatId, sectionName, token);
    }
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
}

// ========== تعديل وحذف المحتوى ==========

async function showEditContentList(chatId, sectionName, token) {
  const section = mainInterface.structure[sectionName];
  if (!section || section.type !== 'section') {
    await sendMessage(chatId, '⚠️ القسم غير موجود', token);
    return;
  }

  const items = section.items || [];
  if (items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لتعديله', token);
    return;
  }

  const buttons = items.map((item, index) => [
    { text: `✏️ ${item.title}`, callback_data: `edit_item_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: `manage_content_${sectionName}` }]);

  await sendMessage(chatId, `✏️ اختر المحتوى لتعديله:`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function showDeleteContentList(chatId, sectionName, token) {
  const section = mainInterface.structure[sectionName];
  if (!section || section.type !== 'section') {
    await sendMessage(chatId, '⚠️ القسم غير موجود', token);
    return;
  }

  const items = section.items || [];
  if (items.length === 0) {
    await sendMessage(chatId, '📂 لا يوجد محتوى لحذفه', token);
    return;
  }

  const buttons = items.map((item, index) => [
    { text: `🗑️ ${item.title}`, callback_data: `delete_item_${sectionName}_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: `manage_content_${sectionName}` }]);

  await sendMessage(chatId, `🗑️ اختر المحتوى للحذف:`, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== دوال إضافية ==========

async function showStatistics(chatId, token) {
  const stats = `📊 الإحصائيات:

👥 المستخدمين:
• ✅ معتمدين: ${Object.keys(approvedUsers).length}
• ⏳ معلق: ${Object.keys(pendingUsers).length}
• ❌ مرفوض: ${Object.keys(rejectedUsers).length}

🎯 الواجهة:
• 📁 مجلدات: ${Object.values(mainInterface.structure).filter(c => c.type === 'folder').length}
• 📂 أقسام: ${Object.values(mainInterface.structure).filter(c => c.type === 'section').length}
• 🔘 أزرار: ${Object.values(mainInterface.structure).filter(c => c.type === 'button').length}
• 📌 مجموع: ${Object.keys(mainInterface.structure).length}

⏱️ آخر تحديث: ${new Date().toLocaleString('ar-EG')}`;

  await sendMessage(chatId, stats, token, {
    reply_markup: { keyboard: [['🔙 العودة']], resize_keyboard: true }
  });
}

// ========== دوال مساعدة ==========

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
