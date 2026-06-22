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

    // ===== معالجة اختيار المستخدم (نص عادي) =====
    await handleUserTextSelection(chatId, text, token);
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

    // ===== معالجة اختيار المستخدم (كولباك) =====
    await handleUserCallback(data, chatId, token);
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
  const message = `📂 إدارة الأقسام\n📁 مجلدات: ${Object.values(categories.structure).filter(c => c.type === 'folder').length}\n📄 أقسام: ${Object.values(categories.structure).filter(c => c.type === 'direct').length}`;

  await sendMessage(chatId, message, token, {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
        ['✏️ تعديل قسم', '🗑️ حذف قسم'],
        ['🔙 رجوع']
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

  await sendMessage(chatId, `✅ تم إنشاء القسم "${name}"`, token);
  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
  await showCategoriesManagement(chatId, token);
}

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

async function showUserMainMenu(chatId, token) {
  if (categories.order.length === 0) {
    await sendMessage(chatId, '📌 البوت قيد الإعداد حالياً.', token);
    return;
  }

  // ===== استخدام أزرار نصية (بدلاً من كولباك) =====
  const buttons = [];
  for (const name of categories.order) {
    const category = categories.structure[name];
    if (!category) continue;
    const icon = category.type === 'folder' ? '📁' : '📄';
    buttons.push([`${icon} ${name}`]);
  }

  await sendMessage(chatId, '🎉 مرحباً! اختر القسم:', token, {
    reply_markup: {
      keyboard: buttons,
      resize_keyboard: true
    }
  });
}

// ===== معالجة اختيار المستخدم من النص (الأزرار النصية) =====
async function handleUserTextSelection(chatId, text, token) {
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
        const children = data.children || [];
        if (children.length === 0) {
          await sendMessage(chatId, `📁 "${name}" فارغ`, token);
          return;
        }
        
        const buttons = children.map(child => {
          const childData = categories.structure[child];
          if (!childData) return null;
          const icon = childData.type === 'folder' ? '📁' : '📄';
          return [`${icon} ${child}`];
        }).filter(Boolean);
        
        buttons.push(['🔙 رجوع']);
        
        await sendMessage(chatId, `📁 محتويات "${name}":`, token, {
          reply_markup: {
            keyboard: buttons,
            resize_keyboard: true
          }
        });
        return;
      }
    }
  }

  // معالجة أزرار المساعدة
  if (text === 'ℹ️ عن البوت') {
    await sendMessage(chatId, '📌 بوت القصص والمقاطع\nالإصدار 2.0\nللتواصل: @jahab', token);
    return;
  }
  
  if (text === '🆘 مساعدة') {
    await sendMessage(chatId, '🆘 للمساعدة:\n• استخدم الأزرار للتنقل\n• اختر القسم المناسب\n• للتواصل: @jahab', token);
    return;
  }

  if (text === '🔙 رجوع') {
    await showUserMainMenu(chatId, token);
    return;
  }

  // إذا لم يتم العثور على تطابق
  await sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
}

// ===== معالجة اختيار المستخدم من الكولباك =====
async function handleUserCallback(data, chatId, token) {
  if (data === 'back_to_menu') {
    await showUserMainMenu(chatId, token);
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
      const children = category.children || [];
      if (children.length === 0) {
        await sendMessage(chatId, `📁 "${name}" فارغ`, token);
        return;
      }

      const buttons = children.map(child => {
        const childData = categories.structure[child];
        if (!childData) return null;
        const icon = childData.type === 'folder' ? '📁' : '📄';
        return [{ text: `${icon} ${child}`, callback_data: `open_${child}` }];
      }).filter(Boolean);

      buttons.push([{ text: '🔙 رجوع', callback_data: 'back_to_menu' }]);

      await sendMessage(chatId, `📁 محتويات "${name}":`, token, {
        reply_markup: { inline_keyboard: buttons }
      });
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

  // معالجة الموافقة/الرفض
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

  // تعديل قسم
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

  // حذف قسم
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
  const stats = `📊 الإحصائيات:\n✅ معتمدين: ${Object.keys(approvedUsers).length}\n⏳ معلق: ${Object.keys(pendingUsers).length}\n❌ مرفوض: ${Object.keys(rejectedUsers).length}\n📂 أقسام: ${Object.keys(categories.structure).length}`;
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
