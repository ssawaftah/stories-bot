// تخزين مؤقت في الذاكرة
const pendingUsers = {};
const rejectedUsers = {};
const approvedUsers = {};

// حالة الأدمن
let adminState = {};

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

  // معالجة الرسائل
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // ========== واجهة الأدمن ==========
    if (userId.toString() === ADMIN_ID) {
      // أمر /admin للدخول إلى لوحة التحكم
      if (text === '/admin') {
        return showAdminPanel(chatId, token);
      }

      // معالجة أزرار الأدمن النصية
      if (text === '📋 الطلبات الجديدة') {
        return showPendingRequests(chatId, token);
      }

      if (text === '❌ الطلبات المرفوضة') {
        return showRejectedRequests(chatId, token);
      }

      if (text === '✅ المستخدمين المعتمدين') {
        return showApprovedUsers(chatId, token);
      }

      if (text === '🔙 العودة للقائمة') {
        return showAdminPanel(chatId, token);
      }

      // أي رسالة أخرى للأدمن
      return sendMessage(chatId, 'استخدم الأزرار للتحكم في البوت', token);
    }

    // ========== واجهة المستخدم ==========
    // التحقق من أن المستخدم مرفوض
    if (rejectedUsers[userId]) {
      return sendMessage(chatId, 
        '❌ عذراً، طلبك مرفوض.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
        token,
        {
          reply_markup: {
            remove_keyboard: true
          }
        }
      );
    }

    // أمر /start
    if (text === '/start') {
      // إذا كان معتمد
      if (approvedUsers[userId]) {
        return sendMessage(chatId, 
          '🎉 مرحباً بك في البوت!\nاختر القسم:', 
          token,
          {
            reply_markup: {
              keyboard: [
                ['📚 قصص', '🎬 مقاطع'],
                ['ℹ️ مساعدة']
              ],
              resize_keyboard: true
            }
          }
        );
      }

      // إذا كان في انتظار الموافقة
      if (pendingUsers[userId]) {
        return sendMessage(chatId, 
          '⏳ طلبك قيد المراجعة، يرجى الانتظار...',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
      }

      // طلب رقم الهاتف
      return sendMessage(chatId,
        '🔐 للتحقق، شارك رقم هاتفك:',
        token,
        {
          reply_markup: {
            keyboard: [
              [{
                text: '📱 مشاركة الرقم',
                request_contact: true
              }]
            ],
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

      if (rejectedUsers[userId]) {
        return sendMessage(chatId, 
          '❌ عذراً، طلبك مرفوض.\nللتواصل: @jahab',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
      }

      if (approvedUsers[userId]) {
        return sendMessage(chatId, 
          '✅ أنت معتمد بالفعل! اضغط /start',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
      }

      // حفظ في قائمة الانتظار
      pendingUsers[userId] = {
        id: userId,
        username: msg.from.username || 'لا يوجد',
        name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
        phone: contact.phone_number,
        time: new Date().toLocaleString('ar-EG')
      };

      await sendMessage(chatId, 
        '⏳ تم استلام طلبك! جاري التحقق من قبل الإدارة...',
        token,
        {
          reply_markup: {
            remove_keyboard: true
          }
        }
      );

      // إعلام الأدمن بطلب جديد
      const userInfo = pendingUsers[userId];
      const adminMsg = `
📢 طلب انضمام جديد!

👤 الاسم: ${userInfo.name}
🆔 اليوزرنيم: @${userInfo.username}
📱 رقم الهاتف: ${userInfo.phone}
🕐 الوقت: ${userInfo.time}

📌 عدد الطلبات المعلقة: ${Object.keys(pendingUsers).length}
      `;

      await sendMessage(ADMIN_ID, adminMsg, token);
      
      return;
    }

    // منع أي أمر آخر للمستخدمين غير المعتمدين
    if (!approvedUsers[userId]) {
      if (rejectedUsers[userId]) {
        return sendMessage(chatId, 
          '❌ طلبك مرفوض. للتواصل: @jahab',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
      }
      
      if (pendingUsers[userId]) {
        return sendMessage(chatId, 
          '⏳ طلبك قيد المراجعة... يرجى الانتظار',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
      }
      
      return sendMessage(chatId, 
        '🔐 يرجى مشاركة رقم هاتفك للتحقق أولاً.\nاضغط /start',
        token,
        {
          reply_markup: {
            keyboard: [
              [{
                text: '📱 مشاركة الرقم',
                request_contact: true
              }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    }

    // مستخدم معتمد - معالجة الأزرار
    if (text === '📚 قصص') {
      return sendMessage(chatId, '📖 قريباً... قسم القصص', token);
    }
    if (text === '🎬 مقاطع') {
      return sendMessage(chatId, '🎥 قريباً... قسم المقاطع', token);
    }
    if (text === 'ℹ️ مساعدة') {
      return sendMessage(chatId, '📌 بوت القصص والمقاطع\nالإصدار 1.0\nللتواصل: @jahab', token);
    }
    
    return sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
  }

  // ========== معالجة أزرار الكولباك ==========
  if (update.callback_query) {
    const query = update.callback_query;
    const userId = query.from.id;
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    // التحقق من الأدمن
    if (userId.toString() !== ADMIN_ID) {
      return answerCallbackQuery(query.id, '❌ هذا الإجراء للإدارة فقط!', token);
    }

    // ===== معالجة قبول/رفض من قائمة الطلبات =====
    if (data.startsWith('approve_')) {
      const targetId = data.split('_')[1];
      
      if (pendingUsers[targetId]) {
        // نقل من المعلق إلى المعتمد
        approvedUsers[targetId] = true;
        const userInfo = pendingUsers[targetId];
        delete pendingUsers[targetId];
        delete rejectedUsers[targetId];
        
        // إرسال للمستخدم
        await sendMessage(targetId, 
          '✅ تمت الموافقة على طلب انضمامك!\nاضغط /start للبدء.',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
        
        // تحديث رسالة الأدمن
        await editMessage(chatId, messageId, 
          `✅ تم قبول المستخدم: ${userInfo.name}\n🆔 @${userInfo.username}`,
          token
        );
        
        // تحديث لوحة الأدمن
        await showAdminPanel(chatId, token, true);
        
        return answerCallbackQuery(query.id, '✅ تم قبول المستخدم', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود في قائمة الانتظار', token);
      }
    }

    if (data.startsWith('reject_')) {
      const targetId = data.split('_')[1];
      
      if (pendingUsers[targetId]) {
        // نقل من المعلق إلى المرفوض
        rejectedUsers[targetId] = true;
        const userInfo = pendingUsers[targetId];
        delete pendingUsers[targetId];
        delete approvedUsers[targetId];
        
        // إرسال للمستخدم
        await sendMessage(targetId, 
          '❌ عذراً، تم رفض طلب انضمامك.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
        
        // تحديث رسالة الأدمن
        await editMessage(chatId, messageId, 
          `❌ تم رفض المستخدم: ${userInfo.name}\n🆔 @${userInfo.username}`,
          token
        );
        
        // تحديث لوحة الأدمن
        await showAdminPanel(chatId, token, true);
        
        return answerCallbackQuery(query.id, '❌ تم رفض المستخدم', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود في قائمة الانتظار', token);
      }
    }

    // ===== معالجة قبول من قائمة المرفوضين =====
    if (data.startsWith('reapprove_')) {
      const targetId = data.split('_')[1];
      
      if (rejectedUsers[targetId]) {
        // نقل من المرفوض إلى المعتمد
        approvedUsers[targetId] = true;
        const userInfo = rejectedUsers[targetId];
        delete rejectedUsers[targetId];
        delete pendingUsers[targetId];
        
        // إرسال للمستخدم
        await sendMessage(targetId, 
          '✅ تم استئناف طلبك والموافقة عليه!\nاضغط /start للبدء.',
          token,
          {
            reply_markup: {
              remove_keyboard: true
            }
          }
        );
        
        // تحديث رسالة الأدمن
        await editMessage(chatId, messageId, 
          `✅ تم إعادة الموافقة على المستخدم: ${userInfo.name}\n🆔 @${userInfo.username}`,
          token
        );
        
        // تحديث لوحة الأدمن
        await showAdminPanel(chatId, token, true);
        
        return answerCallbackQuery(query.id, '✅ تم إعادة الموافقة', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود في قائمة المرفوضين', token);
      }
    }

    // ===== معالجة عرض التفاصيل =====
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
        return answerCallbackQuery(query.id, '✅ تم عرض التفاصيل', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود', token);
      }
    }

    // ===== معالجة حذف من المرفوضين =====
    if (data.startsWith('delete_')) {
      const targetId = data.split('_')[1];
      
      if (rejectedUsers[targetId]) {
        delete rejectedUsers[targetId];
        
        await editMessage(chatId, messageId, 
          `🗑️ تم حذف المستخدم من قائمة المرفوضين`,
          token
        );
        
        // تحديث لوحة الأدمن
        await showAdminPanel(chatId, token, true);
        
        return answerCallbackQuery(query.id, '🗑️ تم الحذف', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود', token);
      }
    }

    // ===== معالجة أزرار التنقل =====
    if (data === 'show_pending') {
      await showPendingRequests(chatId, token);
      return answerCallbackQuery(query.id, '📋 عرض الطلبات', token);
    }
    
    if (data === 'show_rejected') {
      await showRejectedRequests(chatId, token);
      return answerCallbackQuery(query.id, '❌ عرض المرفوضين', token);
    }
    
    if (data === 'show_approved') {
      await showApprovedUsers(chatId, token);
      return answerCallbackQuery(query.id, '✅ عرض المعتمدين', token);
    }
    
    if (data === 'back_to_admin') {
      await showAdminPanel(chatId, token);
      return answerCallbackQuery(query.id, '🔙 العودة للقائمة', token);
    }
  }
}

// ========== دوال واجهة الأدمن ==========

// عرض لوحة التحكم الرئيسية
async function showAdminPanel(chatId, token, silent = false) {
  const pendingCount = Object.keys(pendingUsers).length;
  const rejectedCount = Object.keys(rejectedUsers).length;
  const approvedCount = Object.keys(approvedUsers).length;

  const message = `
👋 مرحباً بك في لوحة تحكم الأدمن

📊 إحصائيات البوت:
• 📋 طلبات جديدة: ${pendingCount}
• ❌ مرفوضين: ${rejectedCount}
• ✅ معتمدين: ${approvedCount}

اختر الإجراء المناسب:
  `;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: `📋 الطلبات الجديدة (${pendingCount})`, callback_data: 'show_pending' }],
        [{ text: `❌ المرفوضين (${rejectedCount})`, callback_data: 'show_rejected' }],
        [{ text: `✅ المعتمدين (${approvedCount})`, callback_data: 'show_approved' }]
      ]
    }
  };

  if (silent) {
    await editMessage(chatId, null, message, token, options);
  } else {
    await sendMessage(chatId, message, token, options);
  }
}

// عرض الطلبات الجديدة
async function showPendingRequests(chatId, token) {
  const pendingList = Object.values(pendingUsers);
  
  if (pendingList.length === 0) {
    return sendMessage(chatId, 
      '📋 لا توجد طلبات جديدة حالياً',
      token,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  }

  let message = '📋 قائمة الطلبات الجديدة:\n\n';
  
  // عرض أول 10 طلبات فقط (لعدم تجاوز حد الطول)
  const displayList = pendingList.slice(0, 10);
  
  for (const user of displayList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n`;
    message += `─────────────────\n`;
  }

  if (pendingList.length > 10) {
    message += `\n⚠️ يوجد ${pendingList.length - 10} طلبات أخرى...`;
  }

  // إنشاء أزرار لكل مستخدم
  const buttons = [];
  for (const user of pendingList) {
    buttons.push([
      { text: `✅ قبول ${user.name}`, callback_data: `approve_${user.id}` },
      { text: `❌ رفض ${user.name}`, callback_data: `reject_${user.id}` }
    ]);
    buttons.push([
      { text: `📋 تفاصيل ${user.name}`, callback_data: `details_${user.id}` }
    ]);
  }
  
  buttons.push([{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// عرض المرفوضين
async function showRejectedRequests(chatId, token) {
  const rejectedList = Object.values(rejectedUsers);
  
  if (rejectedList.length === 0) {
    return sendMessage(chatId, 
      '❌ لا يوجد مستخدمين مرفوضين',
      token,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  }

  let message = '❌ قائمة المستخدمين المرفوضين:\n\n';
  
  const displayList = rejectedList.slice(0, 10);
  
  for (const user of displayList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n`;
    message += `─────────────────\n`;
  }

  if (rejectedList.length > 10) {
    message += `\n⚠️ يوجد ${rejectedList.length - 10} مرفوضين آخرين...`;
  }

  // إنشاء أزرار للمرفوضين (تتيح الموافقة مرة أخرى)
  const buttons = [];
  for (const user of rejectedList) {
    buttons.push([
      { text: `✅ إعادة موافقة ${user.name}`, callback_data: `reapprove_${user.id}` },
      { text: `🗑️ حذف ${user.name}`, callback_data: `delete_${user.id}` }
    ]);
    buttons.push([
      { text: `📋 تفاصيل ${user.name}`, callback_data: `details_${user.id}` }
    ]);
  }
  
  buttons.push([{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// عرض المعتمدين
async function showApprovedUsers(chatId, token) {
  const approvedList = Object.values(approvedUsers);
  
  if (approvedList.length === 0) {
    return sendMessage(chatId, 
      '✅ لا يوجد مستخدمين معتمدين',
      token,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]
          ]
        }
      }
    );
  }

  let message = '✅ قائمة المستخدمين المعتمدين:\n\n';
  
  const displayList = approvedList.slice(0, 10);
  
  for (const user of displayList) {
    message += `👤 ${user.name}\n🆔 @${user.username}\n🕐 ${user.time}\n`;
    message += `─────────────────\n`;
  }

  if (approvedList.length > 10) {
    message += `\n⚠️ يوجد ${approvedList.length - 10} معتمدين آخرين...`;
  }

  // أزرار لعرض التفاصيل
  const buttons = [];
  for (const user of approvedList.slice(0, 5)) {
    buttons.push([
      { text: `📋 تفاصيل ${user.name}`, callback_data: `details_${user.id}` }
    ]);
  }
  
  buttons.push([{ text: '🔙 العودة للقائمة', callback_data: 'back_to_admin' }]);

  await sendMessage(chatId, message, token, {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

// ========== دوال مساعدة ==========

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
