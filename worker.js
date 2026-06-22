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
          
          // الحصول على قائمة الأدمن من متغير البيئة
          const adminIds = (env.ADMIN_IDS || '').split(',').map(id => id.trim());
          
          // === بداية المحادثة ===
          if (text === '/start') {
            const user = await env.BOT_KV.get(`user:${chatId}`, { type: 'json' });
            
            if (user) {
              await sendMsg(env, chatId, '👋 مرحباً بعودتك ' + user.name + '!\n\nأرسل /admin للوحة التحكم.');
            } else {
              await sendMsg(env, chatId, '👋 مرحباً بك!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.', {
                reply_markup: {
                  keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true
                }
              });
            }
            return new Response('OK');
          }
          
          // === استلام جهة الاتصال ===
          if (contact) {
            const user = {
              id: chatId,
              name: (contact.first_name || msg.from.first_name || '') + ' ' + (contact.last_name || msg.from.last_name || ''),
              phone: contact.phone_number,
              username: msg.from.username || '',
              join_date: new Date().toISOString(),
              is_blocked: false
            };
            
            await env.BOT_KV.put(`user:${chatId}`, JSON.stringify(user));
            
            let usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
            if (!usersList.includes(chatId)) {
              usersList.push(chatId);
              await env.BOT_KV.put('users_list', JSON.stringify(usersList));
            }
            
            let welcomeMsg = '✅ تم التحقق من هويتك بنجاح!\n\n';
            welcomeMsg += '📱 رقم هاتفك: ' + contact.phone_number + '\n';
            welcomeMsg += '👤 اسمك: ' + user.name;
            
            await sendMsg(env, chatId, welcomeMsg);
            
            if (adminIds.includes(chatId)) {
              await sendMsg(env, chatId, '🎛 *لوحة تحكم الأدمن*\n\nاختر القسم:', {
                reply_markup: {
                  keyboard: [
                    [{ text: '👥 المستخدمين' }, { text: '📊 المحتوى' }],
                    [{ text: '📁 الأقسام' }, { text: '🔗 اشتراك إجباري' }]
                  ],
                  resize_keyboard: true
                },
                parse_mode: 'Markdown'
              });
            } else {
              await sendMsg(env, chatId, '✅ يمكنك الآن استخدام البوت.\nأرسل /start للبدء من جديد.');
            }
            
            return new Response('OK');
          }
          
          // === أمر الأدمن ===
          if (text === '/admin') {
            if (adminIds.includes(chatId)) {
              await sendMsg(env, chatId, '🎛 *لوحة تحكم الأدمن*', {
                reply_markup: {
                  keyboard: [
                    [{ text: '👥 المستخدمين' }, { text: '📊 المحتوى' }],
                    [{ text: '📁 الأقسام' }, { text: '🔗 اشتراك إجباري' }]
                  ],
                  resize_keyboard: true
                },
                parse_mode: 'Markdown'
              });
            } else {
              await sendMsg(env, chatId, '⛔ غير مصرح لك.');
            }
            return new Response('OK');
          }
          
          // === أزرار القائمة ===
          if (text === '👥 المستخدمين' && adminIds.includes(chatId)) {
            return await showUsers(chatId, env);
          }
          if (text === '📊 المحتوى' && adminIds.includes(chatId)) {
            return await sendMsg(env, chatId, '📊 *إدارة المحتوى*\n\nقيد التطوير...', { parse_mode: 'Markdown' });
          }
          if (text === '📁 الأقسام' && adminIds.includes(chatId)) {
            return await sendMsg(env, chatId, '📁 *إدارة الأقسام*\n\nقيد التطوير...', { parse_mode: 'Markdown' });
          }
          if (text === '🔗 اشتراك إجباري' && adminIds.includes(chatId)) {
            return await sendMsg(env, chatId, '🔗 *الاشتراك الإجباري*\n\nقيد التطوير...', { parse_mode: 'Markdown' });
          }
          if (text === '🔙 رجوع للقائمة الرئيسية' && adminIds.includes(chatId)) {
            await sendMsg(env, chatId, '🎛 *لوحة تحكم الأدمن*', {
              reply_markup: {
                keyboard: [
                  [{ text: '👥 المستخدمين' }, { text: '📊 المحتوى' }],
                  [{ text: '📁 الأقسام' }, { text: '🔗 اشتراك إجباري' }]
                ],
                resize_keyboard: true
              },
              parse_mode: 'Markdown'
            });
            return new Response('OK');
          }
          
          // رد افتراضي
          await sendMsg(env, chatId, 'استخدم /start للبدء أو /admin للوحة التحكم.');
        }
        
        return new Response('OK');
      } catch (error) {
        return new Response('OK');
      }
    }
    
    return new Response('Bot Online ✅');
  }
};

// ==================== دوال المستخدمين ====================
async function showUsers(chatId, env) {
  const usersList = await env.BOT_KV.get('users_list', { type: 'json' }) || [];
  
  if (usersList.length === 0) {
    return await sendMsg(env, chatId, '👥 لا يوجد مستخدمين بعد.');
  }
  
  let text = '👥 *قائمة المستخدمين*\n\n';
  let count = 0;
  
  for (const userId of usersList) {
    const user = await env.BOT_KV.get(`user:${userId}`, { type: 'json' });
    if (user) {
      count++;
      text += `🆔 ${user.id}\n`;
      text += `👤 ${user.name}\n`;
      text += `📱 ${user.phone}\n`;
      text += `📅 ${new Date(user.join_date).toLocaleDateString('ar-SA')}\n`;
      text += `🚫 ${user.is_blocked ? 'محظور' : 'نشط'}\n`;
      text += '➖➖➖➖➖\n';
    }
    
    if (count >= 10) {
      text += `\n... و ${usersList.length - 10} مستخدم آخر`;
      break;
    }
  }
  
  await sendMsg(env, chatId, text, { parse_mode: 'Markdown' });
}

// ==================== دالة الإرسال ====================
async function sendMsg(env, chatId, text, extra = {}) {
  const body = {
    chat_id: chatId,
    text: text,
    ...extra
  };
  
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
