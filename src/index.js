// ========== التخزين المؤقت ==========
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// ========== نظام إدارة الأقسام ==========
const categories = {
  structure: {},
  order: []
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

    // ===== معالجة اختيار المستخدم =====
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

// ========== دوال الأدمن ==========

async function showAdminMainMenu(chatId, token) {
  const message = `👋 مرحباً بك في لوحة التحكم\n📊 الإحصائيات:\n• طلبات: ${Object.keys(pendingUsers).length}\n• مرفوضين: ${Object.keys(rejectedUsers).length}\n• معتمدين: ${Object.keys(approvedUsers).length}\n• أقسام: ${Object.keys(categories.structure).length}`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📋 إدارة الطلبات', '📂 إدارة الأقسام'],
        ['📊 الإحصائيات', '🔙 العودة']
      ],
      resize_keyboard: true
    }
  });
}

async function handleAdminActions(chatId, text, token) {
  if (text === '📋 إدارة الطلبات') {
    await showRequestsManagement(chatId, token);
  } else if (text === '📂 إدارة الأقسام') {
    await showCategoriesManagement(chatId, token);
  } else if (text === '📊 الإحصائيات') {
    await showStatistics(chatId, token);
  } else if (text === '🔙 العودة' || text === 'رجوع') {
    await showAdminMainMenu(chatId, token);
  } else if (text === '📁 إنشاء مجلد') {
    adminState.currentAction = 'create_folder';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📁 أدخل اسم المجلد:', token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
  } else if (text === '📄 إنشاء قسم مباشر') {
    adminState.currentAction = 'create_direct';
    adminState.step = 'waiting_name';
    await sendMessage(chatId, '📄 أدخل اسم القسم:', token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
  } else if (text === '✏️ تعديل قسم') {
    await showEditCategory(chatId, token);
  } else if (text === '🗑️ حذف قسم') {
    await showDeleteCategory(chatId, token);
  } else if (text === '📂 إضافة لمجلد') {
    await showAddToFolder(chatId, token);
  } else if (adminState.currentAction === 'create_folder' && adminState.step === 'waiting_name') {
    await handleCreateFolder(chatId, text, token);
  } else if (adminState.currentAction === 'create_direct' && adminState.step === 'waiting_name') {
    adminState.tempData.name = text;
    adminState.step = 'waiting_content';
    await sendMessage(chatId, `📝 أدخل محتوى القسم "${text}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
  } else if (adminState.currentAction === 'create_direct' && adminState.step === 'waiting_content') {
    await handleCreateDirectContent(chatId, text, token);
  } else if (adminState.currentAction === 'edit_category' && adminState.step === 'waiting_new_name') {
    await handleEditCategoryName(chatId, text, token);
  } else if (adminState.currentAction === 'add_to_folder' && adminState.step === 'waiting_selection') {
    await handleAddToFolder(chatId, text, token);
  } else if (text === '🔙 إلغاء') {
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showAdminMainMenu(chatId, token);
  } else {
    await sendMessage(chatId, '⚠️ خيار غير معروف', token);
  }
}

// ========== إدارة الطلبات ==========

async function showRequestsManagement(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  const message = `📋 الطلبات المعلقة: ${pendingList.length}`;
  
  if (pendingList.length === 0) {
    await sendMessage(chatId, '📋 لا توجد طلبات', token, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]] }
    });
    return;
  }

  const buttons = [];
  for (const user of pendingList) {
    buttons.push([
      { text: `✅ ${user.name}`, callback_data: `approve_${user.id}` },
      { text: `❌ رفض`, callback_data: `reject_${user.id}` }
    ]);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== إدارة الأقسام ==========

async function showCategoriesManagement(chatId, token) {
  const folders = Object.values(categories.structure).filter(c => c.type === 'folder').length;
  const directs = Object.values(categories.structure).filter(c => c.type === 'direct').length;
  
  const message = `📂 إدارة الأقسام\n📁 مجلدات: ${folders}\n📄 أقسام: ${directs}\n📌 مجموع: ${Object.keys(categories.structure).length}`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
        ['✏️ تعديل قسم', '🗑️ حذف قسم'],
        ['📂 إضافة لمجلد', '🔙 رجوع']
      ],
      resize_keyboard: true
    }
  });
}

async function handleCreateFolder(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح:', token);
    return;
  }

  if (categories.structure[text]) {
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  categories.structure[text] = { type: 'folder', children: [] };
  categories.order.push(text);

  await sendMessage(chatId, `✅ تم إنشاء المجلد "${text}"`, token);
  adminState.currentAction = null;
  adminState.step = null;
  await showCategoriesManagement(chatId, token);
}

async function handleCreateDirectContent(chatId, text, token) {
  const name = adminState.tempData.name;
  
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال محتوى:', token);
    return;
  }

  categories.structure[name] = { type: 'direct', content: text };
  categories.order.push(name);

  // عرض خيار إضافة لمجلد
  const folderOptions = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'folder' && key !== name
  );

  if (folderOptions.length > 0) {
    const buttons = folderOptions.map(folder => [
      { text: `📁 ${folder}`, callback_data: `add_existing_to_folder_${name}_${folder}` }
    ]);
    buttons.push([{ text: '🚫 عدم الإضافة', callback_data: `skip_folder_${name}` }]);

    await sendMessage(chatId, 
      `✅ تم إنشاء القسم "${name}"!\n📌 هل تريد إضافته لمجلد؟`,
      token,
      {
        reply_markup: { inline_keyboard: buttons }
      }
    );
  } else {
    await sendMessage(chatId, `✅ تم إنشاء القسم "${name}"`, token);
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showCategoriesManagement(chatId, token);
  }
}

// ========== إضافة قسم لمجلد ==========

async function showAddToFolder(chatId, token) {
  const directSections = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'direct'
  );
  
  const folders = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'folder'
  );

  if (directSections.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام مباشرة لإضافتها', token);
    return;
  }

  if (folders.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد مجلدات لإضافة الأقسام إليها', token);
    return;
  }

  let message = '📂 اختر القسم الذي تريد إضافته لمجلد:\n\n';
  const buttons = [];
  
  for (const section of directSections) {
    buttons.push([
      { text: `📄 ${section}`, callback_data: `add_section_${section}` }
    ]);
  }
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleAddToFolder(chatId, text, token) {
  // هذا يتم التعامل معه عبر الكولباك
  await sendMessage(chatId, '⚠️ استخدم الأزرار للاختيار', token);
}

// ========== تعديل وحذف الأقسام ==========

async function showEditCategory(chatId, token) {
  const list = Object.keys(categories.structure);
  if (list.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام', token);
    return;
  }

  const buttons = list.map(name => [
    { text: `✏️ ${name}`, callback_data: `edit_${name}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, '✏️ اختر القسم:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleEditCategoryName(chatId, text, token) {
  const oldName = adminState.tempData.oldName;
  const category = categories.structure[oldName];
  
  if (!category) {
    await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  if (categories.structure[text] && text !== oldName) {
    await sendMessage(chatId, '⚠️ الاسم موجود بالفعل!', token);
    return;
  }

  delete categories.structure[oldName];
  categories.structure[text] = category;
  
  const index = categories.order.indexOf(oldName);
  if (index !== -1) categories.order[index] = text;

  // تحديث في المجلدات
  for (const key of Object.keys(categories.structure)) {
    if (categories.structure[key].type === 'folder') {
      const children = categories.structure[key].children;
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
  await showCategoriesManagement(chatId, token);
}

async function showDeleteCategory(chatId, token) {
  const list = Object.keys(categories.structure);
  if (list.length === 0) {
    await sendMessage(chatId, '⚠️ لا توجد أقسام', token);
    return;
  }

  const buttons = list.map(name => [
    { text: `🗑️ ${name}`, callback_data: `delete_${name}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, '🗑️ اختر القسم للحذف:', token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== دوال المستخدم ==========

async function showUserMainMenu(chatId, token, userId) {
  if (categories.order.length === 0) {
    await sendMessage(chatId, '📌 البوت قيد الإعداد حالياً.', token);
    return;
  }

  // حفظ حالة المستخدم
  if (userId) {
    userState[userId] = { currentPath: [] };
  }

  const buttons = [];
  for (const name of categories.order) {
    const category = categories.structure[name];
    if (!category) continue;
    const icon = category.type === 'folder' ? '📁' : '📄';
    buttons.push([`${icon} ${name}`]);
  }

  buttons.push(['ℹ️ عن البوت', '🆘 مساعدة']);

  await sendMessage(chatId, '🎉 مرحباً! اختر القسم:', token, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

// ===== معالجة اختيار المستخدم من النص =====
async function handleUserTextSelection(chatId, text, token, userId) {
  // معالجة أزرار المساعدة
  if (text === 'ℹ️ عن البوت') {
    await sendMessage(chatId, '📌 بوت القصص والمقاطع\nالإصدار 2.0\nللتواصل: @jahab', token);
    return;
  }
  
  if (text === '🆘 مساعدة') {
    await sendMessage(chatId, '🆘 للمساعدة:\n• استخدم الأزرار للتنقل\n• اختر القسم المناسب\n• للتواصل: @jahab', token);
    return;
  }

  // معالجة زر الرجوع
  if (text === '🔙 رجوع' || text === 'رجوع') {
    if (userState[userId] && userState[userId].currentPath.length > 0) {
      // العودة إلى المستوى السابق
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

  // إزالة الإيموجي من النص للمقارنة
  const cleanText = text.replace(/[📁📄]/g, '').trim();
  
  // البحث في الأقسام
  for (const [name, data] of Object.entries(categories.structure)) {
    if (name === cleanText) {
      if (data.type === 'direct') {
        // عرض محتوى القسم المباشر
        await sendMessage(chatId, data.content || '⚠️ هذا القسم فارغ', token, { 
          parse_mode: 'HTML' 
        });
        return;
      } else if (data.type === 'folder') {
        // عرض محتويات المجلد
        await showFolderContent(chatId, name, token, userId);
        return;
      }
    }
  }

  // إذا لم يتم العثور على تطابق
  await sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
}

// ===== عرض محتويات المجلد =====
async function showFolderContent(chatId, folderName, token, userId) {
  const folder = categories.structure[folderName];
  if (!folder || folder.type !== 'folder') {
    await sendMessage(chatId, '⚠️ هذا المجلد غير موجود', token);
    return;
  }

  // تحديث مسار المستخدم
  if (userId) {
    if (!userState[userId]) {
      userState[userId] = { currentPath: [] };
    }
    // إضافة المجلد الحالي إلى المسار إذا لم يكن موجوداً
    if (!userState[userId].currentPath.includes(folderName)) {
      userState[userId].currentPath.push(folderName);
    }
  }

  const children = folder.children || [];
  
  if (children.length === 0) {
    const buttons = [['🔙 رجوع']];
    await sendMessage(chatId, `📁 "${folderName}" فارغ`, token, {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true
      }
    });
    return;
  }

  const buttons = [];
  for (const child of children) {
    const childData = categories.structure[child];
    if (!childData) continue;
    const icon = childData.type === 'folder' ? '📁' : '📄';
    buttons.push([`${icon} ${child}`]);
  }
  
  buttons.push(['🔙 رجوع']);

  await sendMessage(chatId, `📁 محتويات "${folderName}":`, token, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

// ===== معالجة كولباك المستخدم =====
async function handleUserCallback(data, chatId, token, userId) {
  if (data === 'back_to_menu') {
    if (userState[userId]) {
      userState[userId].currentPath = [];
    }
    await showUserMainMenu(chatId, token, userId);
    return;
  }

  // معالجة فتح قسم من الكولباك
  if (data.startsWith('open_')) {
    const name = data.replace('open_', '');
    const category = categories.structure[name];
    
    if (!category) {
      await sendMessage(chatId, '⚠️ القسم غير موجود', token);
      return;
    }

    if (category.type === 'direct') {
      await sendMessage(chatId, category.content || '⚠️ هذا القسم فارغ', token, { 
        parse_mode: 'HTML' 
      });
    } else if (category.type === 'folder') {
      await showFolderContent(chatId, name, token, userId);
    }
  }
}

// ========== دوال معالجة كولباك الأدمن ==========

async function handleAdminCallback(data, chatId, messageId, token) {
  if (data === 'admin_back') {
    await showAdminMainMenu(chatId, token);
    return;
  }

  if (data === 'admin_categories_back') {
    await showCategoriesManagement(chatId, token);
    return;
  }

  // ===== إضافة قسم لمجلد (من كولباك) =====
  if (data.startsWith('add_existing_to_folder_')) {
    const parts = data.split('_');
    const sectionName = parts[4];
    const folderName = parts[5];
    
    if (categories.structure[folderName] && categories.structure[folderName].type === 'folder') {
      if (!categories.structure[folderName].children.includes(sectionName)) {
        categories.structure[folderName].children.push(sectionName);
      }
      
      await sendMessage(chatId, 
        `✅ تم إضافة القسم "${sectionName}" إلى مجلد "${folderName}"`,
        token
      );
      
      adminState.currentAction = null;
      adminState.step = null;
      adminState.tempData = {};
      await showCategoriesManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('skip_folder_')) {
    const sectionName = data.split('_')[2];
    await sendMessage(chatId, `✅ تم إنشاء القسم "${sectionName}" بدون إضافة لمجلد`, token);
    adminState.currentAction = null;
    adminState.step = null;
    adminState.tempData = {};
    await showCategoriesManagement(chatId, token);
    return;
  }

  // ===== إضافة قسم لمجلد (من قائمة الإضافة) =====
  if (data.startsWith('add_section_')) {
    const sectionName = data.replace('add_section_', '');
    adminState.tempData.sectionToAdd = sectionName;
    
    const folders = Object.keys(categories.structure).filter(
      key => categories.structure[key].type === 'folder'
    );

    const buttons = folders.map(folder => [
      { text: `📁 ${folder}`, callback_data: `add_to_folder_${sectionName}_${folder}` }
    ]);
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

    await sendMessage(chatId, 
      `📂 اختر المجلد الذي تريد إضافة "${sectionName}" إليه:`,
      token,
      {
        reply_markup: { inline_keyboard: buttons }
      }
    );
    return;
  }

  if (data.startsWith('add_to_folder_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const folderName = parts[4];
    
    if (categories.structure[folderName] && categories.structure[folderName].type === 'folder') {
      if (!categories.structure[folderName].children.includes(sectionName)) {
        categories.structure[folderName].children.push(sectionName);
      }
      
      await sendMessage(chatId, 
        `✅ تم إضافة "${sectionName}" إلى مجلد "${folderName}"`,
        token
      );
      
      adminState.tempData = {};
      await showCategoriesManagement(chatId, token);
    }
    return;
  }

  // ===== معالجة الموافقة/الرفض =====
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

  // ===== تعديل قسم =====
  if (data.startsWith('edit_')) {
    const name = data.replace('edit_', '');
    adminState.currentAction = 'edit_category';
    adminState.step = 'waiting_new_name';
    adminState.tempData.oldName = name;
    
    await sendMessage(chatId, `✏️ أدخل الاسم الجديد للقسم "${name}":`, token, {
      reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true }
    });
    return;
  }

  // ===== حذف قسم =====
  if (data.startsWith('delete_')) {
    const name = data.replace('delete_', '');
    const category = categories.structure[name];
    
    if (!category) {
      await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
      return;
    }

    delete categories.structure[name];
    const index = categories.order.indexOf(name);
    if (index !== -1) categories.order.splice(index, 1);

    // حذف من المجلدات
    for (const key of Object.keys(categories.structure)) {
      if (categories.structure[key].type === 'folder') {
        const children = categories.structure[key].children;
        const childIndex = children.indexOf(name);
        if (childIndex !== -1) children.splice(childIndex, 1);
      }
    }

    await sendMessage(chatId, `✅ تم حذف "${name}"`, token);
    await showCategoriesManagement(chatId, token);
    return;
  }
}

// ========== دوال إضافية ==========

async function showStatistics(chatId, token) {
  const stats = `📊 الإحصائيات:\n✅ معتمدين: ${Object.keys(approvedUsers).length}\n⏳ معلق: ${Object.keys(pendingUsers).length}\n❌ مرفوض: ${Object.keys(rejectedUsers).length}\n📂 أقسام: ${Object.keys(categories.structure).length}\n📁 مجلدات: ${Object.values(categories.structure).filter(c => c.type === 'folder').length}\n📄 أقسام مباشرة: ${Object.values(categories.structure).filter(c => c.type === 'direct').length}`;
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
