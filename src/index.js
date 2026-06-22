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
      return new Response('🤖 البوت يعمل 24 ساعة!', {
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
      return new Response(JSON.stringify(result, null, 2), {
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
      return sendMessage(chatId, 
        '❌ عذراً، طلبك مرفوض.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
        token,
        { reply_markup: { remove_keyboard: true } }
      );
    }

    if (text === '/start') {
      if (approvedUsers[userId]) {
        return showUserMainMenu(chatId, token);
      }

      if (pendingUsers[userId]) {
        return sendMessage(chatId, 
          '⏳ طلبك قيد المراجعة، يرجى الانتظار...',
          token,
          { reply_markup: { remove_keyboard: true } }
        );
      }

      return sendMessage(chatId,
        '🔐 للتحقق، شارك رقم هاتفك:',
        token,
        {
          reply_markup: {
            keyboard: [[{
              text: '📱 مشاركة الرقم',
              request_contact: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    }

    if (msg.contact) {
      const contact = msg.contact;
      
      if (contact.user_id !== userId) {
        return sendMessage(chatId, '❌ يرجى مشاركة رقم هاتفك الخاص فقط!', token);
      }

      if (rejectedUsers[userId] || approvedUsers[userId]) {
        return sendMessage(chatId, '⚠️ تم معالجة طلبك مسبقاً', token);
      }

      const userData = {
        id: userId,
        username: msg.from.username || 'لا يوجد',
        name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
        phone: contact.phone_number,
        time: new Date().toLocaleString('ar-EG')
      };

      pendingUsers[userId] = userData;

      await sendMessage(chatId, 
        '⏳ تم استلام طلبك! جاري التحقق من قبل الإدارة...',
        token,
        { reply_markup: { remove_keyboard: true } }
      );

      const adminMsg = `
📢 طلب انضمام جديد!

👤 الاسم: ${userData.name}
🆔 اليوزرنيم: @${userData.username}
📱 رقم الهاتف: ${userData.phone}
🕐 الوقت: ${userData.time}

📌 عدد الطلبات المعلقة: ${Object.keys(pendingUsers).length}
      `;

      await sendMessage(ADMIN_ID, adminMsg, token);
      return;
    }

    if (!approvedUsers[userId]) {
      if (rejectedUsers[userId]) {
        return sendMessage(chatId, '❌ طلبك مرفوض. للتواصل: @jahab', token, {
          reply_markup: { remove_keyboard: true }
        });
      }
      
      if (pendingUsers[userId]) {
        return sendMessage(chatId, '⏳ طلبك قيد المراجعة...', token, {
          reply_markup: { remove_keyboard: true }
        });
      }
      
      return sendMessage(chatId, 
        '🔐 يرجى مشاركة رقم هاتفك للتحقق أولاً.\nاضغط /start',
        token,
        {
          reply_markup: {
            keyboard: [[{
              text: '📱 مشاركة الرقم',
              request_contact: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    }

    await handleUserSelection(chatId, text, token);
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
      return answerCallbackQuery(query.id, '✅ تم', token);
    }

    await handleUserCallback(data, chatId, token, userId);
    return answerCallbackQuery(query.id, '✅ تم', token);
  }
}

// ========== دوال واجهة الأدمن ==========

async function showAdminMainMenu(chatId, token) {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  const approvedCount = Object.keys(approvedUsers).length;
  const categoriesCount = Object.keys(categories.structure).length;

  const message = `
👋 مرحباً بك في لوحة تحكم الأدمن

📊 إحصائيات البوت:
• 📋 طلبات جديدة: ${pendingCount}
• ❌ مرفوضين: ${rejectedCount}
• ✅ معتمدين: ${approvedCount}
• 📂 أقسام: ${categoriesCount}

📌 اختر الإجراء المناسب:
  `;

  const keyboard = {
    reply_markup: {
      keyboard: [
        ['📋 إدارة الطلبات', '📂 إدارة الأقسام'],
        ['📊 الإحصائيات', '⚙️ إعدادات البوت'],
        ['📢 إرسال إشعار', '🔄 تصدير/استيراد'],
        ['🔙 العودة للقائمة']
      ],
      resize_keyboard: true
    }
  };

  await sendMessage(chatId, message, token, keyboard);
}

async function handleAdminActions(chatId, text, token) {
  switch(text) {
    case '📋 إدارة الطلبات':
      await showRequestsManagement(chatId, token);
      break;
      
    case '📂 إدارة الأقسام':
      await showCategoriesManagement(chatId, token);
      break;
      
    case '📊 الإحصائيات':
      await showStatistics(chatId, token);
      break;
      
    case '⚙️ إعدادات البوت':
      await showSettings(chatId, token);
      break;
      
    case '📢 إرسال إشعار':
      adminState.currentAction = 'broadcast';
      adminState.step = 'waiting_message';
      await sendMessage(chatId, 
        '📝 أرسل الرسالة التي تريد إرسالها لجميع المستخدمين:',
        token,
        { reply_markup: { keyboard: [['🔙 إلغاء']], resize_keyboard: true } }
      );
      break;
      
    case '🔄 تصدير/استيراد':
      await showExportImport(chatId, token);
      break;
      
    case '🔙 العودة للقائمة':
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
      
    // ===== معالجة إنشاء المجلد =====
    case '📁 إنشاء مجلد':
      adminState.currentAction = 'create_folder';
      adminState.step = 'waiting_name';
      await sendMessage(chatId, 
        '📁 أدخل اسم المجلد الجديد:',
        token,
        {
          reply_markup: {
            keyboard: [['🔙 إلغاء']],
            resize_keyboard: true
          }
        }
      );
      break;
      
    // ===== معالجة إنشاء قسم مباشر =====
    case '📄 إنشاء قسم مباشر':
      adminState.currentAction = 'create_direct';
      adminState.step = 'waiting_name';
      await sendMessage(chatId, 
        '📄 أدخل اسم القسم الجديد:',
        token,
        {
          reply_markup: {
            keyboard: [['🔙 إلغاء']],
            resize_keyboard: true
          }
        }
      );
      break;
      
    // ===== معالجة تعديل قسم =====
    case '✏️ تعديل قسم':
      await showEditCategory(chatId, token);
      break;
      
    // ===== معالجة حذف قسم =====
    case '🗑️ حذف قسم':
      await showDeleteCategory(chatId, token);
      break;
      
    // ===== معالجة ترتيب الأقسام =====
    case '📊 ترتيب الأقسام':
      await showReorderCategories(chatId, token);
      break;
      
    // ===== معالجة نسخ قسم =====
    case '📋 نسخ قسم':
      await showCopyCategory(chatId, token);
      break;
      
    default:
      // معالجة إنشاء الأقسام
      if (adminState.currentAction === 'create_folder' && adminState.step === 'waiting_name') {
        await handleCreateFolder(chatId, text, token);
      } else if (adminState.currentAction === 'create_direct' && adminState.step === 'waiting_name') {
        await handleCreateDirectName(chatId, text, token);
      } else if (adminState.currentAction === 'create_direct' && adminState.step === 'waiting_content') {
        await handleCreateDirectContent(chatId, text, token);
      } else if (adminState.currentAction === 'edit_category' && adminState.step === 'waiting_new_name') {
        await handleEditCategoryName(chatId, text, token);
      } else if (adminState.currentAction === 'edit_category' && adminState.step === 'waiting_new_content') {
        await handleEditCategoryContent(chatId, text, token);
      } else if (adminState.currentAction === 'broadcast' && adminState.step === 'waiting_message') {
        await sendBroadcast(chatId, text, token);
        adminState.currentAction = null;
        adminState.step = null;
      } else if (adminState.currentAction === 'import' && adminState.step === 'waiting_data') {
        await handleImportData(chatId, text, token);
      }
      break;
  }
}

// ========== إدارة الطلبات ==========

async function showRequestsManagement(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  const rejectedList = Object.values(rejectedUsers);
  
  let message = '📋 إدارة الطلبات:\n\n';
  message += `📌 الطلبات المعلقة: ${pendingList.length}\n`;
  message += `❌ المرفوضين: ${rejectedList.length}\n\n`;
  message += `اختر القائمة:`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: `📋 الطلبات الجديدة (${pendingList.length})`, callback_data: 'admin_pending' }],
        [{ text: `❌ المرفوضين (${rejectedList.length})`, callback_data: 'admin_rejected' }],
        [{ text: `✅ المعتمدين (${Object.keys(approvedUsers).length})`, callback_data: 'admin_approved' }],
        [{ text: '🔙 العودة للقائمة', callback_data: 'admin_back' }]
      ]
    }
  };

  await sendMessage(chatId, message, token, keyboard);
}

// ========== إدارة الأقسام المتكاملة ==========

async function showCategoriesManagement(chatId, token) {
  const folders = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'folder'
  );
  const directs = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'direct'
  );

  let message = `
📂 إدارة الأقسام

📊 الإحصائيات:
• 📁 مجلدات: ${folders.length}
• 📄 أقسام مباشرة: ${directs.length}
• 📌 مجموع الأقسام: ${Object.keys(categories.structure).length}

🔹 إنشاء قسم جديد:
• 📁 مجلد جديد
• 📄 قسم مباشر

🔸 إدارة الأقسام:
• ✏️ تعديل قسم
• 🗑️ حذف قسم
• 📊 ترتيب الأقسام
• 📋 نسخ قسم
  `;

  const keyboard = {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
        ['✏️ تعديل قسم', '🗑️ حذف قسم'],
        ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
        ['🔙 العودة للقائمة']
      ],
      resize_keyboard: true
    }
  };

  await sendMessage(chatId, message, token, keyboard);
}

// ========== إنشاء مجلد ==========

async function handleCreateFolder(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح للمجلد:', token);
    return;
  }

  if (categories.structure[text]) {
    await sendMessage(chatId, 
      '⚠️ هذا الاسم موجود بالفعل! الرجاء اختيار اسم آخر:',
      token
    );
    return;
  }

  categories.structure[text] = {
    type: 'folder',
    children: [],
    created: new Date().toLocaleString('ar-EG')
  };
  categories.order.push(text);

  await sendMessage(chatId, 
    `✅ تم إنشاء المجلد "${text}" بنجاح!\n\n🔹 يمكنك الآن إضافة أقسام إليه.`,
    token,
    {
      reply_markup: {
        keyboard: [
          ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
          ['✏️ تعديل قسم', '🗑️ حذف قسم'],
          ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
          ['🔙 العودة للقائمة']
        ],
        resize_keyboard: true
      }
    }
  );

  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
}

// ========== إنشاء قسم مباشر ==========

async function handleCreateDirectName(chatId, text, token) {
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال اسم صالح للقسم:', token);
    return;
  }

  if (categories.structure[text]) {
    await sendMessage(chatId, 
      '⚠️ هذا الاسم موجود بالفعل! الرجاء اختيار اسم آخر:',
      token
    );
    return;
  }

  adminState.tempData.name = text;
  adminState.step = 'waiting_content';
  
  await sendMessage(chatId, 
    `📝 أدخل محتوى القسم "${text}":\n\n(يمكنك استخدام HTML للتنسيق)\nمثال: <b>نص غامق</b>`,
    token,
    {
      reply_markup: {
        keyboard: [['🔙 إلغاء']],
        resize_keyboard: true
      }
    }
  );
}

async function handleCreateDirectContent(chatId, text, token) {
  const name = adminState.tempData.name;
  
  if (!text || text.trim() === '') {
    await sendMessage(chatId, '⚠️ الرجاء إدخال محتوى للقسم:', token);
    return;
  }
  
  categories.structure[name] = {
    type: 'direct',
    content: text,
    created: new Date().toLocaleString('ar-EG')
  };
  categories.order.push(name);

  const folderOptions = Object.keys(categories.structure).filter(
    key => categories.structure[key].type === 'folder' && key !== name
  );

  if (folderOptions.length > 0) {
    const buttons = folderOptions.map(folder => [
      { text: `📁 ${folder}`, callback_data: `add_to_folder_${name}_${folder}` }
    ]);
    buttons.push([{ text: '🚫 عدم الإضافة', callback_data: `skip_folder_${name}` }]);

    await sendMessage(chatId, 
      `✅ تم إنشاء القسم "${name}"!\n\n📌 هل تريد إضافته لمجلد؟`,
      token,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
  } else {
    await sendMessage(chatId, 
      `✅ تم إنشاء القسم "${name}" بنجاح!\n\n💡 يمكنك إنشاء مجلدات لإضافة الأقسام إليها.`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
  }

  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
}

// ========== تعديل قسم ==========

async function showEditCategory(chatId, token) {
  const categoryList = Object.keys(categories.structure);
  
  if (categoryList.length === 0) {
    await sendMessage(chatId, 
      '⚠️ لا توجد أقسام لتعديلها.',
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  const buttons = categoryList.map(cat => [
    { text: `✏️ ${cat}`, callback_data: `edit_select_${cat}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, 
    '✏️ اختر القسم الذي تريد تعديله:',
    token,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
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
    await sendMessage(chatId, '⚠️ هذا الاسم موجود بالفعل!', token);
    return;
  }

  delete categories.structure[oldName];
  categories.structure[text] = category;
  
  const index = categories.order.indexOf(oldName);
  if (index !== -1) {
    categories.order[index] = text;
  }

  for (const key of Object.keys(categories.structure)) {
    if (categories.structure[key].type === 'folder') {
      const children = categories.structure[key].children;
      const childIndex = children.indexOf(oldName);
      if (childIndex !== -1) {
        children[childIndex] = text;
      }
    }
  }

  await sendMessage(chatId, 
    `✅ تم تعديل اسم القسم إلى "${text}" بنجاح!`,
    token,
    {
      reply_markup: {
        keyboard: [
          ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
          ['✏️ تعديل قسم', '🗑️ حذف قسم'],
          ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
          ['🔙 العودة للقائمة']
        ],
        resize_keyboard: true
      }
    }
  );

  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
}

async function handleEditCategoryContent(chatId, text, token) {
  const name = adminState.tempData.name;
  const category = categories.structure[name];
  
  if (!category || category.type !== 'direct') {
    await sendMessage(chatId, '⚠️ هذا القسم ليس قسمًا مباشرًا!', token);
    adminState.currentAction = null;
    adminState.step = null;
    return;
  }

  category.content = text;

  await sendMessage(chatId, 
    `✅ تم تحديث محتوى القسم "${name}" بنجاح!`,
    token,
    {
      reply_markup: {
        keyboard: [
          ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
          ['✏️ تعديل قسم', '🗑️ حذف قسم'],
          ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
          ['🔙 العودة للقائمة']
        ],
        resize_keyboard: true
      }
    }
  );

  adminState.currentAction = null;
  adminState.step = null;
  adminState.tempData = {};
}

// ========== حذف قسم ==========

async function showDeleteCategory(chatId, token) {
  const categoryList = Object.keys(categories.structure);
  
  if (categoryList.length === 0) {
    await sendMessage(chatId, 
      '⚠️ لا توجد أقسام لحذفها.',
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  const buttons = categoryList.map(cat => [
    { text: `🗑️ ${cat}`, callback_data: `delete_select_${cat}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, 
    '🗑️ اختر القسم الذي تريد حذفه:',
    token,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

// ========== ترتيب الأقسام ==========

async function showReorderCategories(chatId, token) {
  if (categories.order.length === 0) {
    await sendMessage(chatId, 
      '⚠️ لا توجد أقسام لترتيبها.',
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  let message = '📊 الترتيب الحالي للأقسام:\n\n';
  categories.order.forEach((name, index) => {
    const type = categories.structure[name]?.type === 'folder' ? '📁' : '📄';
    message += `${index + 1}. ${type} ${name}\n`;
  });

  message += '\n🔹 اختر قسماً لنقله:';

  const buttons = categories.order.map((name, index) => [
    { text: `${index + 1}. ${name}`, callback_data: `reorder_select_${index}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== نسخ قسم ==========

async function showCopyCategory(chatId, token) {
  const categoryList = Object.keys(categories.structure);
  
  if (categoryList.length === 0) {
    await sendMessage(chatId, 
      '⚠️ لا توجد أقسام لنسخها.',
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  const buttons = categoryList.map(cat => [
    { text: `📋 نسخ ${cat}`, callback_data: `copy_select_${cat}` }
  ]);
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

  await sendMessage(chatId, 
    '📋 اختر القسم الذي تريد نسخه:',
    token,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

// ========== تصدير/استيراد ==========

async function showExportImport(chatId, token) {
  const message = `
🔄 تصدير/استيراد الإعدادات

📤 تصدير: احصل على نسخة من جميع الأقسام
📥 استيراد: استعادة نسخة محفوظة مسبقاً

⚠️ تحذير: الاستيراد سيحل محل الأقسام الحالية!
  `;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 تصدير الأقسام', callback_data: 'export_data' }],
        [{ text: '📥 استيراد الأقسام', callback_data: 'import_data' }],
        [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
      ]
    }
  };

  await sendMessage(chatId, message, token, keyboard);
}

async function handleImportData(chatId, text, token) {
  try {
    const data = JSON.parse(text);
    
    if (!data.categories || !data.order) {
      throw new Error('بيانات غير صالحة');
    }

    Object.keys(categories.structure).forEach(key => delete categories.structure[key]);
    categories.order.length = 0;
    
    Object.assign(categories.structure, data.categories);
    categories.order.push(...data.order);

    await sendMessage(chatId, 
      `✅ تم استيراد ${Object.keys(categories.structure).length} قسم بنجاح!`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );

    adminState.currentAction = null;
    adminState.step = null;
    
  } catch (error) {
    await sendMessage(chatId, 
      '⚠️ بيانات غير صالحة! تأكد من أنك تنسخ البيانات الصحيحة.',
      token
    );
  }
}

// ========== عرض الأقسام للمستخدم ==========

async function showUserMainMenu(chatId, token) {
  if (categories.order.length === 0) {
    return sendMessage(chatId, 
      '📌 البوت قيد الإعداد حالياً.\nيرجى المحاولة لاحقاً.',
      token
    );
  }

  const buttons = [];
  
  for (const categoryName of categories.order) {
    const category = categories.structure[categoryName];
    if (!category) continue;
    
    if (category.type === 'folder') {
      buttons.push([{ text: `📁 ${categoryName}`, callback_data: `folder_${categoryName}` }]);
    } else if (category.type === 'direct') {
      buttons.push([{ text: `📄 ${categoryName}`, callback_data: `direct_${categoryName}` }]);
    }
  }

  buttons.push(['ℹ️ عن البوت', '🆘 مساعدة']);

  await sendMessage(chatId, 
    '🎉 مرحباً بك في البوت!\nاختر القسم الذي تريده:',
    token,
    {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true
      }
    }
  );
}

// ========== دوال معالجة الكولباك ==========

async function handleAdminCallback(data, chatId, messageId, token) {
  // ===== إدارة الطلبات =====
  if (data === 'admin_pending') {
    await showPendingRequests(chatId, token);
    return;
  }
  
  if (data === 'admin_rejected') {
    await showRejectedRequests(chatId, token);
    return;
  }
  
  if (data === 'admin_approved') {
    await showApprovedUsers(chatId, token);
    return;
  }
  
  if (data === 'admin_back') {
    await showAdminMainMenu(chatId, token);
    return;
  }

  if (data === 'admin_categories_back') {
    await showCategoriesManagement(chatId, token);
    return;
  }

  // ===== إضافة لمجلد =====
  if (data.startsWith('add_to_folder_')) {
    const parts = data.split('_');
    const sectionName = parts[3];
    const folderName = parts[4];
    
    if (categories.structure[folderName] && categories.structure[folderName].type === 'folder') {
      if (!categories.structure[folderName].children.includes(sectionName)) {
        categories.structure[folderName].children.push(sectionName);
      }
      
      await sendMessage(chatId, 
        `✅ تم إضافة القسم "${sectionName}" إلى مجلد "${folderName}"`,
        token,
        {
          reply_markup: {
            keyboard: [
              ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
              ['✏️ تعديل قسم', '🗑️ حذف قسم'],
              ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
              ['🔙 العودة للقائمة']
            ],
            resize_keyboard: true
          }
        }
      );
    }
    return;
  }

  if (data.startsWith('skip_folder_')) {
    const sectionName = data.split('_')[2];
    await sendMessage(chatId, 
      `✅ تم إنشاء القسم "${sectionName}" بدون إضافة لمجلد`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // ===== تعديل قسم =====
  if (data.startsWith('edit_select_')) {
    const name = data.replace('edit_select_', '');
    const category = categories.structure[name];
    
    if (!category) {
      await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
      return;
    }

    const buttons = [
      [{ text: '✏️ تغيير الاسم', callback_data: `edit_name_${name}` }]
    ];

    if (category.type === 'direct') {
      buttons.push([{ text: '✏️ تغيير المحتوى', callback_data: `edit_content_${name}` }]);
    }

    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

    await sendMessage(chatId, 
      `✏️ تعديل القسم: "${name}"\n\nنوع: ${category.type === 'folder' ? '📁 مجلد' : '📄 قسم مباشر'}\nاختر ما تريد تعديله:`,
      token,
      {
        reply_markup: { inline_keyboard: buttons }
      }
    );
    return;
  }

  if (data.startsWith('edit_name_')) {
    const name = data.replace('edit_name_', '');
    adminState.currentAction = 'edit_category';
    adminState.step = 'waiting_new_name';
    adminState.tempData.oldName = name;
    
    await sendMessage(chatId, 
      `✏️ أدخل الاسم الجديد للقسم "${name}":`,
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

  if (data.startsWith('edit_content_')) {
    const name = data.replace('edit_content_', '');
    adminState.currentAction = 'edit_category';
    adminState.step = 'waiting_new_content';
    adminState.tempData.name = name;
    
    await sendMessage(chatId, 
      `✏️ أدخل المحتوى الجديد للقسم "${name}":\n\n(يمكنك استخدام HTML)`,
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

  // ===== حذف قسم =====
  if (data.startsWith('delete_select_')) {
    const name = data.replace('delete_select_', '');
    const category = categories.structure[name];
    
    if (!category) {
      await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
      return;
    }

    const buttons = [
      [
        { text: '✅ نعم، احذف', callback_data: `delete_confirm_${name}` },
        { text: '❌ إلغاء', callback_data: 'admin_categories_back' }
      ]
    ];

    await sendMessage(chatId, 
      `⚠️ هل أنت متأكد من حذف القسم "${name}"؟\n\nنوع: ${category.type === 'folder' ? '📁 مجلد' : '📄 قسم مباشر'}\n${category.type === 'folder' ? `📌 يحتوي على ${category.children?.length || 0} أقسام فرعية` : ''}`,
      token,
      {
        reply_markup: { inline_keyboard: buttons }
      }
    );
    return;
  }

  if (data.startsWith('delete_confirm_')) {
    const name = data.replace('delete_confirm_', '');
    
    delete categories.structure[name];
    
    const index = categories.order.indexOf(name);
    if (index !== -1) {
      categories.order.splice(index, 1);
    }
    
    for (const key of Object.keys(categories.structure)) {
      if (categories.structure[key].type === 'folder') {
        const children = categories.structure[key].children;
        const childIndex = children.indexOf(name);
        if (childIndex !== -1) {
          children.splice(childIndex, 1);
        }
      }
    }

    await sendMessage(chatId, 
      `✅ تم حذف القسم "${name}" بنجاح!`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // ===== ترتيب الأقسام =====
  if (data.startsWith('reorder_select_')) {
    const index = parseInt(data.replace('reorder_select_', ''));
    adminState.tempData.reorderIndex = index;
    
    const buttons = [];
    for (let i = 0; i < categories.order.length; i++) {
      if (i !== index) {
        buttons.push([
          { text: `⬆️ نقل إلى ${i + 1}`, callback_data: `reorder_move_${index}_${i}` }
        ]);
      }
    }
    buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_categories_back' }]);

    await sendMessage(chatId, 
      `📊 اختر الموقع الجديد للقسم "${categories.order[index]}":`,
      token,
      {
        reply_markup: { inline_keyboard: buttons }
      }
    );
    return;
  }

  if (data.startsWith('reorder_move_')) {
    const parts = data.split('_');
    const from = parseInt(parts[2]);
    const to = parseInt(parts[3]);
    
    const item = categories.order.splice(from, 1)[0];
    categories.order.splice(to, 0, item);

    await sendMessage(chatId, 
      `✅ تم تحديث الترتيب بنجاح!`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // ===== نسخ قسم =====
  if (data.startsWith('copy_select_')) {
    const name = data.replace('copy_select_', '');
    const category = categories.structure[name];
    
    if (!category) {
      await sendMessage(chatId, '⚠️ القسم غير موجود!', token);
      return;
    }

    let newName = name + '_نسخة';
    let counter = 1;
    while (categories.structure[newName]) {
      counter++;
      newName = name + '_نسخة_' + counter;
    }

    categories.structure[newName] = JSON.parse(JSON.stringify(category));
    categories.order.push(newName);

    await sendMessage(chatId, 
      `✅ تم نسخ القسم "${name}" إلى "${newName}" بنجاح!`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '📋 نسخ قسم'],
            ['🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // ===== تصدير/استيراد =====
  if (data === 'export_data') {
    const exportData = {
      categories: categories.structure,
      order: categories.order,
      exported: new Date().toLocaleString('ar-EG'),
      total: Object.keys(categories.structure).length
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    
    await sendMessage(chatId, 
      `📤 بيانات الأقسام:\n\n<pre>${jsonData}</pre>\n\n📌 انسخ هذه البيانات للاستيراد لاحقاً.`,
      token,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (data === 'import_data') {
    adminState.currentAction = 'import';
    adminState.step = 'waiting_data';
    
    await sendMessage(chatId, 
      '📥 أرسل بيانات الأقسام التي تريد استيرادها (JSON):',
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

  // ===== معالجة الموافقة/الرفض =====
  if (data.startsWith('approve_')) {
    const targetId = data.split('_')[1];
    if (pendingUsers[targetId]) {
      approvedUsers[targetId] = pendingUsers[targetId];
      delete pendingUsers[targetId];
      delete rejectedUsers[targetId];
      
      await sendMessage(targetId, '✅ تمت الموافقة على طلبك! اضغط /start', token, {
        reply_markup: { remove_keyboard: true }
      });
      
      await editMessage(chatId, messageId, `✅ تم قبول المستخدم`, token);
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
      
      await editMessage(chatId, messageId, `❌ تم رفض المستخدم`, token);
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
      
      await sendMessage(targetId, '✅ تم استئناف طلبك والموافقة عليه! اضغط /start', token, {
        reply_markup: { remove_keyboard: true }
      });
      
      await editMessage(chatId, messageId, `✅ تم إعادة الموافقة`, token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }

  if (data.startsWith('details_')) {
    const targetId = data.split('_')[1];
    let userInfo = pendingUsers[targetId] || rejectedUsers[targetId] || approvedUsers[targetId];
    
    if (userInfo) {
      const status = pendingUsers[targetId] ? '⏳ قيد الانتظار' : 
                    rejectedUsers[targetId] ? '❌ مرفوض' : '✅ معتمد';
      
      const details = `
📋 تفاصيل المستخدم:

👤 الاسم: ${userInfo.name}
🆔 اليوزرنيم: @${userInfo.username}
📱 رقم الهاتف: ${userInfo.phone}
🕐 تاريخ الطلب: ${userInfo.time}
📌 الحالة: ${status}
🆔 المعرف: ${targetId}
      `;
      
      await sendMessage(chatId, details, token);
    }
    return;
  }

  if (data.startsWith('delete_user_')) {
    const targetId = data.split('_')[2];
    if (rejectedUsers[targetId]) {
      delete rejectedUsers[targetId];
      await editMessage(chatId, messageId, `🗑️ تم حذف المستخدم`, token);
      await showRequestsManagement(chatId, token);
    }
    return;
  }
}

// ========== دوال عرض القوائم ==========

async function showPendingRequests(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  
  if (pendingList.length === 0) {
    return sendMessage(chatId, '📋 لا توجد طلبات جديدة', token, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]]
      }
    });
  }

  let message = '📋 الطلبات الجديدة:\n\n';
  const buttons = [];
  
  for (const user of pendingList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n─────────────────\n`;
    buttons.push([
      { text: `✅ قبول ${user.name}`, callback_data: `approve_${user.id}` },
      { text: `❌ رفض ${user.name}`, callback_data: `reject_${user.id}` }
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
    return sendMessage(chatId, '❌ لا يوجد مرفوضين', token, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]]
      }
    });
  }

  let message = '❌ المرفوضين:\n\n';
  const buttons = [];
  
  for (const user of rejectedList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n─────────────────\n`;
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
    return sendMessage(chatId, '✅ لا يوجد معتمدين', token, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'admin_back' }]]
      }
    });
  }

  let message = '✅ المعتمدين:\n\n';
  const buttons = [];
  
  for (const user of approvedList.slice(0, 10)) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n─────────────────\n`;
    buttons.push([
      { text: `📋 تفاصيل ${user.name}`, callback_data: `details_${user.id}` }
    ]);
  }
  
  buttons.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========== دوال إضافية ==========

async function showStatistics(chatId, token) {
  const stats = `
📊 إحصائيات البوت:

👥 المستخدمين:
• ✅ معتمدين: ${Object.keys(approvedUsers).length}
• ⏳ قيد الانتظار: ${Object.keys(pendingUsers).length}
• ❌ مرفوضين: ${Object.keys(rejectedUsers).length}

📂 الأقسام:
• 📁 مجلدات: ${Object.values(categories.structure).filter(c => c.type === 'folder').length}
• 📄 أقسام مباشرة: ${Object.values(categories.structure).filter(c => c.type === 'direct').length}
• 📌 مجموع الأقسام: ${Object.keys(categories.structure).length}

⏱️ آخر تحديث: ${new Date().toLocaleString('ar-EG')}
  `;

  await sendMessage(chatId, stats, token, {
    reply_markup: {
      keyboard: [['🔙 العودة للقائمة']],
      resize_keyboard: true
    }
  });
}

async function showSettings(chatId, token) {
  const settings = `
⚙️ إعدادات البوت:

🔹 أوامر الأدمن:
• /admin - لوحة التحكم
• /start - القائمة الرئيسية

🔸 إدارة المستخدمين:
• قبول/رفض الطلبات
• إعادة الموافقة على المرفوضين

📂 إدارة الأقسام:
• إنشاء مجلدات وأقسام
• تعديل وحذف الأقسام
• ترتيب الأقسام
• نسخ الأقسام

📢 البث الجماعي:
• إرسال رسائل لجميع المستخدمين

🔄 تصدير/استيراد:
• حفظ واستعادة إعدادات الأقسام

💡 نصيحة: استخدم الأزرار للتنقل بسهولة
  `;

  await sendMessage(chatId, settings, token, {
    reply_markup: {
      keyboard: [['🔙 العودة للقائمة']],
      resize_keyboard: true
    }
  });
}

async function sendBroadcast(chatId, message, token) {
  const users = Object.keys(approvedUsers);
  let sent = 0;
  let failed = 0;

  for (const userId of users) {
    try {
      await sendMessage(userId, 
        `📢 إشعار من الإدارة:\n\n${message}`,
        token
      );
      sent++;
    } catch (error) {
      failed++;
    }
  }

  await sendMessage(chatId, 
    `✅ تم إرسال الإشعار:\n• تم الإرسال: ${sent}\n• فشل: ${failed}\n• إجمالي: ${users.length}`,
    token,
    {
      reply_markup: {
        keyboard: [
          ['📋 إدارة الطلبات', '📂 إدارة الأقسام'],
          ['📊 الإحصائيات', '⚙️ إعدادات البوت'],
          ['📢 إرسال إشعار', '🔄 تصدير/استيراد'],
          ['🔙 العودة للقائمة']
        ],
        resize_keyboard: true
      }
    }
  );

  adminState.currentAction = null;
  adminState.step = null;
}

// ========== دوال المستخدم ==========

async function handleUserSelection(chatId, text, token) {
  if (text === 'ℹ️ عن البوت') {
    return sendMessage(chatId, 
      '📌 بوت القصص والمقاطع\nالإصدار 2.0\nللتواصل: @jahab',
      token
    );
  }
  
  if (text === '🆘 مساعدة') {
    return sendMessage(chatId, 
      '🆘 للمساعدة:\n• استخدم الأزرار للتنقل\n• اختر القسم المناسب\n• للتواصل: @jahab',
      token
    );
  }

  if (categories.structure[text] && categories.structure[text].type === 'direct') {
    const content = categories.structure[text].content;
    return sendMessage(chatId, content, token, { parse_mode: 'HTML' });
  }

  return sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
}

async function handleUserCallback(data, chatId, token, userId) {
  if (data.startsWith('folder_')) {
    const folderName = data.replace('folder_', '');
    const folder = categories.structure[folderName];
    
    if (folder && folder.type === 'folder') {
      const children = folder.children || [];
      
      if (children.length === 0) {
        return sendMessage(chatId, `📁 "${folderName}" فارغ حالياً`, token);
      }

      const buttons = children.map(child => {
        const childData = categories.structure[child];
        if (childData && childData.type === 'direct') {
          return [{ text: `📄 ${child}`, callback_data: `direct_${child}` }];
        } else if (childData && childData.type === 'folder') {
          return [{ text: `📁 ${child}`, callback_data: `folder_${child}` }];
        }
        return null;
      }).filter(Boolean);

      buttons.push([{ text: '🔙 رجوع', callback_data: 'back_to_menu' }]);

      await sendMessage(chatId, `📁 محتويات "${folderName}":`, token, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
    return;
  }

  if (data.startsWith('direct_')) {
    const sectionName = data.replace('direct_', '');
    const section = categories.structure[sectionName];
    
    if (section && section.type === 'direct') {
      await sendMessage(chatId, section.content, token, { parse_mode: 'HTML' });
    }
    return;
  }

  if (data === 'back_to_menu') {
    await showUserMainMenu(chatId, token);
    return;
  }
}

// ========== دوال مساعدة أساسية ==========

async function sendMessage(chatId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function editMessage(chatId, messageId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options
  };

  if (messageId) {
    payload.message_id = messageId;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (error) {
    console.error('Error editing message:', error);
  }
}

async function answerCallbackQuery(callbackId, text, token) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Error answering callback:', error);
  }
}
