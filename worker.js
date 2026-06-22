export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message) {
          const msg = update.message;
          const chatId = msg.chat.id.toString();
          const text = msg.text || '';
          const contact = msg.contact;
          const adminIds = (env.ADMIN_IDS || '').split(',').map(id => id.trim());
          const isAdmin = adminIds.includes(chatId);
          
          // ====== /start ======
          if (text === '/start') {
            // هل هو معتمد؟
            const approved = await env.BOT_KV.get(`user:${chatId}`, { type: 'json' });
            if (approved && approved.approved) {
              return await sendMsg(env, chatId, '👋 مرحباً بعودتك ' + approved.name + '!');
            }
            
            // هل طلبه معلق؟
            const pending = await env.BOT_KV.get(`pending:${chatId}`, { type: 'json' });
            if (pending) {
              return await sendMsg(env, chatId, '⏳ طلبك قيد المراجعة. انتظر الرد.');
            }
            
            // طلب رقم الهاتف
            return await sendMsg(env, chatId, 
              '👋 مرحباً!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.',
              {
                reply_markup: JSON.stringify({
                  keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true
                })
              }
            );
          }
          
          // ====== استلام جهة الاتصال ======
          if (contact) {
            const phone = contact.phone_number;
            const name = (contact.first_name || msg.from.first_name || '');
            const lastName = contact.last_name || msg.from.last_name || '';
            const fullName = (name + ' ' + lastName).trim();
            
            // حفظ الطلب المعلق
            const request = {
              id: chatId,
              name: fullName,
              phone: phone,
              date: new Date().toISOString()
            };
            
            await env.BOT_KV.put(`pending:${chatId}`, JSON.stringify(request));
            
            // إضافة للقائمة
            let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            if (!pendingList.includes(chatId)) {
              pendingList.push(chatId);
              await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
            }
            
            // إشعار المستخدم
            await sendMsg(env, chatId,
              '📋 *تم استلام طلبك*\n\n' +
              '📱 الرقم: ' + phone + '\n' +
              '⏳ طلبك قيد المراجعة.',
              { parse_mode: 'Markdown' }
            );
            
            // إشعار الأدمن
            for (const adminId of adminIds) {
              await sendMsg(env, adminId,
                '🔔 *طلب انضمام جديد*\n\n' +
                '👤 ' + fullName + '\n' +
                '📱 ' + phone + '\n' +
                '🆔 `' + chatId + '`',
                {
                  parse_mode: 'Markdown',
                  reply_markup: JSON.stringify({
                    inline_keyboard: [[
                      { text: '✅ قبول', callback_data: 'approve_' + chatId },
                      { text: '❌ رفض', callback_data: 'reject_' + chatId }
                    ]]
                  })
                }
              );
            }
            
            return new Response('OK');
          }
          
          // ====== admin ======
          if (text === '/admin') {
            if (!isAdmin) return await sendMsg(env, chatId, '⛔ غير مصرح.');
            
            const pendingCount = (await env.BOT_KV.get('pending_list', { type: 'json' }) || []).length;
            const usersCount = (await env.BOT_KV.get('users_list', { type: 'json' }) || []).length;
            
            return await sendMsg(env, chatId,
              '🎛 *لوحة التحكم*\n\n' +
              '📋 طلبات معلقة: ' + pendingCount + '\n' +
              '👥 مستخدمين: ' + usersCount,
              {
                parse_mode: 'Markdown',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: '📋 الطلبات المعلقة', callback_data: 'pending' }],
                    [{ text: '👥 المستخدمين', callback_data: 'users' }]
                  ]
                })
              }
            );
          }
          
          return await sendMsg(env, chatId, 'استخدم /start للبدء.');
        }
        
        // ====== الأزرار ======
        if (update.callback_query) {
          const cb = update.callback_query;
          const chatId = cb.message.chat.id.toString();
          const data = cb.data;
          const msgId = cb.message.message_id;
          
          // قبول مستخدم
          if (data.startsWith('approve_')) {
            const userId = data.replace('approve_', '');
            const request = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
            
            if (!request) {
              await answerCb(env, cb.id, 'الطلب لم يعد موجوداً');
              return new Response('OK');
            }
            
            // حفظ كمستخدم
            const user = {
              id: userId,
              name: request.name,
              phone: request.phone,
              join_date: Date.now(),
              approved: true,
              is_blocked: false
            };
            
            await env.BOT_KV.put(`user:${userId}`, JSON.stringify(user));
            await env.BOT_KV.delete(`pending:${userId}`);
            
            // تحديث القوائم
            let usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            if (!usersList.includes(userId)) {
              usersList.push(userId);
              await env.BOT_KV.put('users_list', JSON.stringify(usersList));
            }
            
            let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            pendingList = pendingList.filter(id => id !== userId);
            await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
            
            // إشعار المستخدم
            await sendMsg(env, userId, '✅ *تم قبول طلبك!*\n\nأهلاً بك في البوت.');
            
            // تحديث رسالة الأدمن
            await editMsg(env, chatId, msgId, '✅ تم قبول: ' + request.name);
            await answerCb(env, cb.id, 'تم القبول');
            
            return new Response('OK');
          }
          
          // رفض مستخدم
          if (data.startsWith('reject_')) {
            const userId = data.replace('reject_', '');
            const request = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
            
            if (!request) {
              await answerCb(env, cb.id, 'الطلب لم يعد موجوداً');
              return new Response('OK');
            }
            
            await env.BOT_KV.delete(`pending:${userId}`);
            
            let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            pendingList = pendingList.filter(id => id !== userId);
            await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
            
            // إشعار المستخدم
            await sendMsg(env, userId, '❌ *تم رفض طلبك.*\n\nعذراً، لم يتم قبولك.');
            
            // تحديث رسالة الأدمن
            await editMsg(env, chatId, msgId, '❌ تم رفض: ' + request.name);
            await answerCb(env, cb.id, 'تم الرفض');
            
            return new Response('OK');
          }
          
          // عرض الطلبات المعلقة
          if (data === 'pending') {
            const pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            
            if (pendingList.length === 0) {
              await editMsg(env, chatId, msgId, '📋 لا توجد طلبات معلقة.');
              await answerCb(env, cb.id, 'لا يوجد');
              return new Response('OK');
            }
            
            let text = '📋 *الطلبات المعلقة*\n\n';
            
            for (const uid of pendingList) {
              const req = await env.BOT_KV.get(`pending:${uid}`, { type: 'json' });
              if (req) {
                text += '👤 ' + req.name + '\n📱 ' + req.phone + '\n➖➖➖\n';
              }
            }
            
            await editMsg(env, chatId, msgId, text, { parse_mode: 'Markdown' });
            await answerCb(env, cb.id, 'تم');
            return new Response('OK');
          }
          
          // عرض المستخدمين
          if (data === 'users') {
            const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            
            if (usersList.length === 0) {
              await editMsg(env, chatId, msgId, '👥 لا يوجد مستخدمين.');
              await answerCb(env, cb.id, 'لا يوجد');
              return new Response('OK');
            }
            
            let text = '👥 *المستخدمين*\n\n';
            
            for (const uid of usersList.slice(0, 20)) {
              const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
              if (u) {
                text += '👤 ' + u.name + '\n📱 ' + u.phone + '\n🆔 `' + uid + '`\n➖➖➖\n';
              }
            }
            
            await editMsg(env, chatId, msgId, text, { parse_mode: 'Markdown' });
            await answerCb(env, cb.id, 'تم');
            return new Response('OK');
          }
          
          await answerCb(env, cb.id, 'تم');
        }
        
        return new Response('OK');
      } catch(e) {
        return new Response('OK');
      }
    }
    
    return new Response('Bot Online ✅');
  }
};

// دوال مساعدة
async function sendMsg(env, chatId, text, extra = {}) {
  const body = { chat_id: chatId, text: text };
  if (extra.parse_mode) body.parse_mode = extra.parse_mode;
  if (extra.reply_markup) body.reply_markup = JSON.parse(extra.reply_markup);
  
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function editMsg(env, chatId, msgId, text, extra = {}) {
  const body = { chat_id: chatId, message_id: msgId, text: text };
  if (extra.parse_mode) body.parse_mode = extra.parse_mode;
  
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCb(env, cbId, text) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId, text: text })
  });
}
