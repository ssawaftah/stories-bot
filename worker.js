export default {
  async fetch(request, env) {
    // للزيارة المباشرة
    if (request.method === 'GET') {
      const hasToken = env.BOT_TOKEN ? '✅ موجود' : '❌ مفقود';
      const hasAdmin = env.ADMIN_IDS ? '✅ موجود' : '❌ مفقود';
      return new Response(`Bot Ready\nToken: ${hasToken}\nAdmin: ${hasAdmin}`);
    }
    
    // لاستقبال تحديثات تيليجرام
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message) {
          const msg = update.message;
          const chatId = msg.chat.id;
          const text = msg.text || '';
          const contact = msg.contact;
          const adminIds = (env.ADMIN_IDS || '').split(',').map(id => id.trim());
          const isAdmin = adminIds.includes(chatId.toString());
          
          // === /start ===
          if (text === '/start') {
            // التحقق إذا كان معتمد
            const user = await env.BOT_KV.get(`user:${chatId}`, { type: 'json' });
            if (user && user.approved) {
              return await this.sendTg(env, chatId, '👋 مرحباً ' + user.name + '!');
            }
            
            // التحقق إذا كان معلق
            const pending = await env.BOT_KV.get(`pending:${chatId}`, { type: 'json' });
            if (pending) {
              return await this.sendTg(env, chatId, '⏳ طلبك قيد المراجعة.');
            }
            
            // طلب رقم الهاتف
            return await this.sendTg(env, chatId, '👋 مرحباً!\nللتحقق من هويتك، شارك رقم هاتفك.', {
              reply_markup: {
                keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            });
          }
          
          // === استلام جهة الاتصال ===
          if (contact) {
            const phone = contact.phone_number;
            const name = (contact.first_name || msg.from.first_name || '') + 
                        ' ' + (contact.last_name || msg.from.last_name || '');
            
            // حفظ الطلب
            const request = {
              id: chatId.toString(),
              name: name.trim(),
              phone: phone,
              date: new Date().toISOString()
            };
            
            await env.BOT_KV.put(`pending:${chatId}`, JSON.stringify(request));
            
            // تحديث القائمة
            let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            if (!pendingList.includes(chatId.toString())) {
              pendingList.push(chatId.toString());
              await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
            }
            
            // إشعار المستخدم
            await this.sendTg(env, chatId, '📋 تم استلام طلبك\n📱 ' + phone + '\n⏳ قيد المراجعة');
            
            // إشعار كل الأدمن
            for (const adminId of adminIds) {
              await this.sendTg(env, adminId, 
                '🔔 *طلب جديد*\n\n' +
                '👤 ' + name.trim() + '\n' +
                '📱 ' + phone + '\n' +
                '🆔 `' + chatId + '`',
                {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '✅ قبول', callback_data: 'ok_' + chatId },
                      { text: '❌ رفض', callback_data: 'no_' + chatId }
                    ]]
                  }
                }
              );
            }
            
            return new Response('OK');
          }
          
          // === /admin ===
          if (text === '/admin') {
            if (!isAdmin) return await this.sendTg(env, chatId, '⛔ غير مصرح');
            
            const pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            
            return await this.sendTg(env, chatId, 
              '🎛 *لوحة التحكم*\n\n📋 معلق: ' + pendingList.length + '\n👥 مستخدمين: ' + usersList.length,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '📋 الطلبات المعلقة', callback_data: 'pending' }],
                    [{ text: '👥 المستخدمين', callback_data: 'users' }]
                  ]
                }
              }
            );
          }
          
          return await this.sendTg(env, chatId, 'استخدم /start');
        }
        
        // === الأزرار (callback) ===
        if (update.callback_query) {
          const cb = update.callback_query;
          const chatId = cb.message.chat.id;
          const data = cb.data;
          const msgId = cb.message.message_id;
          
          // قبول
          if (data.startsWith('ok_')) {
            const userId = data.slice(3);
            const req = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
            
            if (!req) {
              await this.answerCb(env, cb.id, 'انتهى الطلب');
              return new Response('OK');
            }
            
            // حفظ كمستخدم معتمد
            const user = {
              id: userId,
              name: req.name,
              phone: req.phone,
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
            await this.sendTg(env, userId, '✅ *تم قبول طلبك!*\nأهلاً بك في البوت.', { parse_mode: 'Markdown' });
            
            // تحديث رسالة الأدمن
            await this.editTg(env, chatId, msgId, '✅ تم قبول: ' + req.name);
            await this.answerCb(env, cb.id, 'تم القبول ✓');
            
            return new Response('OK');
          }
          
          // رفض
          if (data.startsWith('no_')) {
            const userId = data.slice(3);
            const req = await env.BOT_KV.get(`pending:${userId}`, { type: 'json' });
            
            if (!req) {
              await this.answerCb(env, cb.id, 'انتهى الطلب');
              return new Response('OK');
            }
            
            await env.BOT_KV.delete(`pending:${userId}`);
            
            let pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            pendingList = pendingList.filter(id => id !== userId);
            await env.BOT_KV.put('pending_list', JSON.stringify(pendingList));
            
            // إشعار المستخدم
            await this.sendTg(env, userId, '❌ *تم رفض طلبك.*', { parse_mode: 'Markdown' });
            
            // تحديث رسالة الأدمن
            await this.editTg(env, chatId, msgId, '❌ تم رفض: ' + req.name);
            await this.answerCb(env, cb.id, 'تم الرفض ✗');
            
            return new Response('OK');
          }
          
          // عرض المعلقين
          if (data === 'pending') {
            const pendingList = await env.BOT_KV.get('pending_list', { type: 'json' }) || [];
            
            if (pendingList.length === 0) {
              await this.editTg(env, chatId, msgId, '📋 لا توجد طلبات.');
              await this.answerCb(env, cb.id, 'لا يوجد');
              return new Response('OK');
            }
            
            let text = '📋 *معلق*\n\n';
            for (const uid of pendingList) {
              const r = await env.BOT_KV.get(`pending:${uid}`, { type: 'json' });
              if (r) text += '👤 ' + r.name + ' | 📱 ' + r.phone + '\n';
            }
            
            await this.editTg(env, chatId, msgId, text, { parse_mode: 'Markdown' });
            await this.answerCb(env, cb.id, 'تم');
            return new Response('OK');
          }
          
          // عرض المستخدمين
          if (data === 'users') {
            const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            
            if (usersList.length === 0) {
              await this.editTg(env, chatId, msgId, '👥 لا يوجد مستخدمين.');
              await this.answerCb(env, cb.id, 'لا يوجد');
              return new Response('OK');
            }
            
            let text = '👥 *مستخدمين*\n\n';
            for (const uid of usersList.slice(0, 20)) {
              const u = await env.BOT_KV.get(`user:${uid}`, { type: 'json' });
              if (u) text += '👤 ' + u.name + ' | 📱 ' + u.phone + '\n';
            }
            
            await this.editTg(env, chatId, msgId, text, { parse_mode: 'Markdown' });
            await this.answerCb(env, cb.id, 'تم');
            return new Response('OK');
          }
          
          await this.answerCb(env, cb.id, 'تم');
        }
        
        return new Response('OK');
      } catch(e) {
        return new Response('OK');
      }
    }
    
    return new Response('OK');
  },
  
  // دوال مساعدة
  async sendTg(env, chatId, text, extra = {}) {
    const body = { chat_id: String(chatId), text: text, ...extra };
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },
  
  async editTg(env, chatId, msgId, text, extra = {}) {
    const body = { chat_id: String(chatId), message_id: msgId, text: text, ...extra };
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },
  
  async answerCb(env, cbId, text) {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId, text: text })
    });
  }
};
