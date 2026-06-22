// تخزين مؤقت في الذاكرة
const pendingUsers = {};
const approvedUsers = {};
const rejectedUsers = {};

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

    // التحقق من أن المستخدم مرفوض
    if (rejectedUsers[userId]) {
      return sendMessage(chatId, 
        '❌ عذراً، طلبك مرفوض.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
        token,
        {
          reply_markup: {
            remove_keyboard: true  // إخفاء الكيبورد بالكامل
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
              remove_keyboard: true  // إخفاء زر مشاركة الرقم
            }
          }
        );
      }

      // طلب رقم الهاتف (للمستخدمين الجدد)
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
      
      // التأكد من أن المستخدم يشارك رقمه الخاص
      if (contact.user_id !== userId) {
        return sendMessage(chatId, '❌ يرجى مشاركة رقم هاتفك الخاص فقط!', token);
      }

      // التأكد من أنه ليس مرفوضاً مسبقاً
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

      // التأكد من أنه ليس معتمداً مسبقاً
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

      // حفظ في الذاكرة المؤقتة
      pendingUsers[userId] = {
        id: userId,
        username: msg.from.username || 'لا يوجد',
        name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
        phone: contact.phone_number,
        time: new Date().toLocaleString('ar-EG')
      };

      // إرسال للمستخدم مع إخفاء الكيبورد
      await sendMessage(chatId, 
        '⏳ تم استلام طلبك! جاري التحقق من قبل الإدارة...',
        token,
        {
          reply_markup: {
            remove_keyboard: true  // إخفاء زر مشاركة الرقم فوراً
          }
        }
      );

      // إرسال للأدمن
      const userInfo = pendingUsers[userId];
      const adminMsg = `
👤 طلب انضمام جديد:

الاسم: ${userInfo.name}
اليوزرنيم: @${userInfo.username}
رقم الهاتف: ${userInfo.phone}
التاريخ: ${userInfo.time}

🆔 معرف المستخدم: ${userId}
      `;

      await sendMessage(ADMIN_ID, adminMsg, token, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ قبول', callback_data: `approve_${userId}` },
              { text: '❌ رفض', callback_data: `reject_${userId}` }
            ]
          ]
        }
      });
      
      return;
    }

    // منع أي أمر آخر للمستخدمين غير المعتمدين أو المرفوضين
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

    // هنا يصل فقط المستخدمون المعتمدون
    if (text === '📚 قصص') {
      return sendMessage(chatId, '📖 قريباً... قسم القصص', token);
    }
    if (text === '🎬 مقاطع') {
      return sendMessage(chatId, '🎥 قريباً... قسم المقاطع', token);
    }
    if (text === 'ℹ️ مساعدة') {
      return sendMessage(chatId, '📌 بوت القصص والمقاطع\nالإصدار 1.0\nللتواصل: @jahab', token);
    }
    
    // أي رسالة أخرى من مستخدم معتمد
    return sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
  }

  // معالجة أزرار الأدمن
  if (update.callback_query) {
    const query = update.callback_query;
    const userId = query.from.id;
    const data = query.data;
    const adminChatId = query.message.chat.id;
    const messageId = query.message.message_id;

    // التحقق من الأدمن
    if (userId.toString() !== ADMIN_ID) {
      return answerCallbackQuery(query.id, '❌ هذا الإجراء للإدارة فقط!', token);
    }

    const [action, targetId] = data.split('_');

    if (action === 'approve') {
      // قبول المستخدم
      if (pendingUsers[targetId]) {
        approvedUsers[targetId] = true;
        delete pendingUsers[targetId];
        delete rejectedUsers[targetId];
        
        // إرسال للمستخدم
        await sendMessage(targetId, 
          '✅ تمت الموافقة على طلب انضمامك!\nاضغط /start للبدء.',
          token,
          {
            reply_markup: {
              remove_keyboard: true  // إخفاء أي كيبورد موجود
            }
          }
        );
        
        // تحديث رسالة الأدمن
        await editMessage(adminChatId, messageId, 
          '✅ ✅ تم قبول المستخدم بنجاح',
          token
        );
        
        return answerCallbackQuery(query.id, '✅ تم قبول المستخدم', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود في قائمة الانتظار', token);
      }
      
    } else if (action === 'reject') {
      // رفض المستخدم
      if (pendingUsers[targetId]) {
        rejectedUsers[targetId] = true;
        delete pendingUsers[targetId];
        delete approvedUsers[targetId];
        
        // إرسال للمستخدم مع إخفاء الكيبورد
        await sendMessage(targetId, 
          '❌ عذراً، تم رفض طلب انضمامك.\nإذا كان لديك استفسار، تواصل مع الإدارة عبر @jahab',
          token,
          {
            reply_markup: {
              remove_keyboard: true  // إخفاء الكيبورد بالكامل
            }
          }
        );
        
        // تحديث رسالة الأدمن
        await editMessage(adminChatId, messageId, 
          '❌ ❌ تم رفض المستخدم',
          token
        );
        
        return answerCallbackQuery(query.id, '❌ تم رفض المستخدم', token);
      } else {
        return answerCallbackQuery(query.id, '⚠️ المستخدم غير موجود في قائمة الانتظار', token);
      }
    }
  }
}

// دوال مساعدة
async function sendMessage(chatId, text, token, options = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
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

async function editMessage(chatId, messageId, text, token) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text
      })
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
