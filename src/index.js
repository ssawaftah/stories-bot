// تخزين مؤقت في الذاكرة (يُفقد عند إعادة التشغيل)
const pendingUsers = {};
const approvedUsers = {};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // صفحة رئيسية
    if (url.pathname === '/') {
      return new Response('🤖 البوت يعمل 24 ساعة!', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // استقبال الويب هوك
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        await handleTelegramUpdate(body, env);
        return new Response('OK', { status: 200 });
      } catch (error) {
        return new Response('Error: ' + error.message, { status: 500 });
      }
    }

    // تعيين الويب هوك
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

// دالة معالجة التحديثات
async function handleTelegramUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const ADMIN_ID = env.ADMIN_ID;

  // معالجة الرسائل
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // أمر /start
    if (text === '/start') {
      // التحقق من الموافقة
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
        return sendMessage(chatId, '❌ شارك رقمك الخاص فقط!', token);
      }

      // حفظ في الذاكرة المؤقتة
      pendingUsers[userId] = {
        id: userId,
        username: msg.from.username || 'لا يوجد',
        name: msg.from.first_name + ' ' + (msg.from.last_name || ''),
        phone: contact.phone_number,
        time: new Date().toLocaleString('ar-EG')
      };

      await sendMessage(chatId, '⏳ طلبك قيد المراجعة...', token);

      // إرسال للأدمن
      const userInfo = pendingUsers[userId];
      const adminMsg = `
👤 طلب انضمام جديد:

الاسم: ${userInfo.name}
اليوزرنيم: @${userInfo.username}
رقم الهاتف: ${userInfo.phone}
التاريخ: ${userInfo.time}
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

    // معالجة الأزرار العادية
    if (approvedUsers[userId]) {
      if (text === '📚 قصص') {
        return sendMessage(chatId, '📖 قريباً... قسم القصص', token);
      }
      if (text === '🎬 مقاطع') {
        return sendMessage(chatId, '🎥 قريباً... قسم المقاطع', token);
      }
      if (text === 'ℹ️ مساعدة') {
        return sendMessage(chatId, 'بوت القصص والمقاطع\nللتواصل: @jahab', token);
      }
    } else {
      return sendMessage(chatId, '⏳ انتظر الموافقة على طلبك', token);
    }
  }

  // معالجة أزرار الأدمن
  if (update.callback_query) {
    const query = update.callback_query;
    const userId = query.from.id;
    const data = query.data;
    const adminChatId = query.message.chat.id;

    // التحقق من الأدمن
    if (userId.toString() !== ADMIN_ID) {
      return answerCallbackQuery(query.id, '❌ هذا للإدارة فقط!', token);
    }

    const [action, targetId] = data.split('_');

    if (action === 'approve') {
      // قبول المستخدم
      approvedUsers[targetId] = true;
      delete pendingUsers[targetId];
      
      await sendMessage(targetId, '✅ تم قبول طلبك! اضغط /start', token);
      await sendMessage(adminChatId, '✅ تم قبول الطلب', token);
      
      return answerCallbackQuery(query.id, '✅ تم القبول', token);
      
    } else if (action === 'reject') {
      // رفض المستخدم
      delete pendingUsers[targetId];
      
      await sendMessage(targetId, '❌ عذراً، طلبك مرفوض.\nللتواصل: @jahab', token);
      await sendMessage(adminChatId, '❌ تم رفض الطلب', token);
      
      return answerCallbackQuery(query.id, '❌ تم الرفض', token);
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
