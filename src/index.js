// ========== التخزين المؤقت ==========
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// ========== نظام إدارة الأقسام ==========
const categories = {
  // هيكل الأقسام
  structure: {
    // مثال: 'قصص': { type: 'folder', children: ['قصص مضحكة', 'قصص حزينة'] },
    // مثال: 'معلومات': { type: 'direct', content: 'معلومات البوت...' }
  },
  // تخزين المحتوى للأقسام المباشرة
  content: {
    // 'قصص مضحكة': 'نص القصة...'
  },
  // ترتيب الأقسام
  order: []
};

// ========== حالة الأدمن ==========
const adminState = {
  currentAction: null, // 'create_folder', 'create_direct', 'edit', 'delete'
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
      // معالجة أوامر الأدمن
      if (text === '/start' || text === '/admin') {
        await showAdminMainMenu(chatId, token);
        return;
      }

      // معالجة أزرار الأدمن
      await handleAdminActions(chatId, text, token);
      return;
    }

    // ========== واجهة المستخدم ==========
    // التحقق من المرفوضين
    if (rejectedUsers[userId]) {
      return sendMessage(chatId, 
        '❌ عذراً، طلبك مرفوض.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
        token,
        {
          reply_markup: { remove_keyboard: true }
        }
      );
    }

    // أمر /start للمستخدم
    if (text === '/start') {
      // إذا كان معتمد
      if (approvedUsers[userId]) {
        return showUserMainMenu(chatId, token);
      }

      // إذا كان في انتظار الموافقة
      if (pendingUsers[userId]) {
        return sendMessage(chatId, 
          '⏳ طلبك قيد المراجعة، يرجى الانتظار...',
          token,
          {
            reply_markup: { remove_keyboard: true }
          }
        );
      }

      // طلب رقم الهاتف
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

    // استقبال رقم الهاتف
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
        {
          reply_markup: { remove_keyboard: true }
        }
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

    // منع المستخدمين غير المعتمدين
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

    // ========== معالجة اختيارات المستخدم ==========
    await handleUserSelection(chatId, text, token);
    return;
  }

  // ========== معالجة أزرار الكولباك ==========
  if (update.callback_query) {
    const query = update.callback_query;
    const userId = query.from.id;
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    // التحقق من الأدمن
    if (userId.toString() === ADMIN_ID) {
      await handleAdminCallback(data, chatId, messageId, token);
      return answerCallbackQuery(query.id, '✅ تم', token);
    }

    // معالجة كولباك المستخدم
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
        ['📢 إرسال إشعار', '🔙 العودة للقائمة']
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
        token
      );
      break;
      
    case '🔙 العودة للقائمة':
    case 'رجوع':
      await showAdminMainMenu(chatId, token);
      break;
      
    default:
      // معالجة إنشاء الأقسام
      if (adminState.currentAction === 'create_folder') {
        await handleCreateFolder(chatId, text, token);
      } else if (adminState.currentAction === 'create_direct') {
        await handleCreateDirect(chatId, text, token);
      } else if (adminState.currentAction === 'broadcast' && adminState.step === 'waiting_message') {
        await sendBroadcast(chatId, text, token);
        adminState.currentAction = null;
        adminState.step = null;
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

// ========== إدارة الأقسام ==========

async function showCategoriesManagement(chatId, token) {
  const message = `
📂 إدارة الأقسام

🔹 إنشاء قسم جديد:
• 📁 مجلد جديد
• 📄 قسم مباشر

🔸 إدارة الأقسام الحالية:
• ✏️ تعديل قسم
• 🗑️ حذف قسم
• 📊 ترتيب الأقسام

اختر الإجراء:
  `;

  const keyboard = {
    reply_markup: {
      keyboard: [
        ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
        ['✏️ تعديل قسم', '🗑️ حذف قسم'],
        ['📊 ترتيب الأقسام', '🔙 العودة للقائمة']
      ],
      resize_keyboard: true
    }
  };

  await sendMessage(chatId, message, token, keyboard);
}

// ========== إنشاء مجلد ==========

async function handleCreateFolder(chatId, text, token) {
  if (!adminState.currentAction) {
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
    return;
  }

  if (adminState.step === 'waiting_name') {
    // التحقق من عدم وجود المجلد
    if (categories.structure[text]) {
      await sendMessage(chatId, 
        '⚠️ هذا المجلد موجود بالفعل! الرجاء اختيار اسم آخر:',
        token
      );
      return;
    }

    // إنشاء المجلد
    categories.structure[text] = {
      type: 'folder',
      children: [],
      created: new Date().toLocaleString('ar-EG')
    };
    categories.order.push(text);

    await sendMessage(chatId, 
      `✅ تم إنشاء المجلد "${text}" بنجاح!`,
      token,
      {
        reply_markup: {
          keyboard: [
            ['📁 إنشاء مجلد', '📄 إنشاء قسم مباشر'],
            ['✏️ تعديل قسم', '🗑️ حذف قسم'],
            ['📊 ترتيب الأقسام', '🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );

    adminState.currentAction = null;
    adminState.step = null;
  }
}

// ========== إنشاء قسم مباشر ==========

async function handleCreateDirect(chatId, text, token) {
  if (!adminState.currentAction) {
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
    return;
  }

  if (adminState.step === 'waiting_name') {
    // حفظ الاسم المؤقت
    adminState.tempData.name = text;
    adminState.step = 'waiting_content';
    
    await sendMessage(chatId, 
      `📝 أدخل محتوى القسم "${text}":\n\n(يمكنك استخدام HTML للتنسيق)`,
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

  if (adminState.step === 'waiting_content') {
    const name = adminState.tempData.name;
    
    // إنشاء القسم المباشر
    categories.structure[name] = {
      type: 'direct',
      content: text,
      created: new Date().toLocaleString('ar-EG')
    };
    categories.order.push(name);

    // عرض خيار إضافة لمجلد
    const folderOptions = Object.keys(categories.structure).filter(
      key => categories.structure[key].type === 'folder'
    );

    if (folderOptions.length > 0) {
      const buttons = folderOptions.map(folder => [
        { text: `📁 ${folder}`, callback_data: `add_to_folder_${name}_${folder}` }
      ]);
      buttons.push([{ text: '🚫 عدم الإضافة لمجلد', callback_data: `skip_folder_${name}` }]);

      await sendMessage(chatId, 
        `✅ تم إنشاء القسم "${name}"!\n\nهل تريد إضافته لمجلد؟`,
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
              ['📊 ترتيب الأقسام', '🔙 العودة للقائمة']
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
}

// ========== عرض الأقسام للمستخدم ==========

async function showUserMainMenu(chatId, token) {
  // بناء قائمة الأقسام
  const buttons = [];
  
  // عرض الأقسام حسب الترتيب
  for (const categoryName of categories.order) {
    const category = categories.structure[categoryName];
    if (!category) continue;
    
    if (category.type === 'folder') {
      buttons.push([{ text: `📁 ${categoryName}`, callback_data: `folder_${categoryName}` }]);
    } else if (category.type === 'direct') {
      buttons.push([{ text: `📄 ${categoryName}`, callback_data: `direct_${categoryName}` }]);
    }
  }

  // إضافة أزرار مساعدة
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

// ========== دوال مساعدة متقدمة ==========

async function handleAdminCallback(data, chatId, messageId, token) {
  // معالجة طلبات الأدمن
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

  // معالجة إضافة قسم لمجلد
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
              ['📊 ترتيب الأقسام', '🔙 العودة للقائمة']
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
            ['📊 ترتيب الأقسام', '🔙 العودة للقائمة']
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // معالجة الموافقة/الرفض
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

  if (data.startsWith('delete_')) {
    const targetId = data.split('_')[1];
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
      { text: `🗑️ حذف`, callback_data: `delete_${user.id}` }
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

📢 البث الجماعي:
• إرسال رسائل لجميع المستخدمين

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
          ['📢 إرسال إشعار', '🔙 العودة للقائمة']
        ],
        resize_keyboard: true
      }
    }
  );
}

// ========== دوال المستخدم ==========

async function handleUserSelection(chatId, text, token) {
  // معالجة اختيارات المستخدم
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

  // البحث عن القسم المباشر
  if (categories.structure[text] && categories.structure[text].type === 'direct') {
    const content = categories.structure[text].content;
    return sendMessage(chatId, content, token, { parse_mode: 'HTML' });
  }

  return sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
}

async function handleUserCallback(data, chatId, token, userId) {
  // معالجة فتح مجلد
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

  // معالجة عرض قسم مباشر
  if (data.startsWith('direct_')) {
    const sectionName = data.replace('direct_', '');
    const section = categories.structure[sectionName];
    
    if (section && section.type === 'direct') {
      await sendMessage(chatId, section.content, token, { parse_mode: 'HTML' });
    }
    return;
  }

  // العودة للقائمة
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
