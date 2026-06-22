
export default {
  async fetch(request, env) {
    // استجابة للزيارة المباشرة
    if (request.method === 'GET') {
      return new Response('Bot is running! ✅');
    }
    
    // معالجة تحديثات تيليجرام
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        
        if (update.message) {
          const chatId = update.message.chat.id;
          const text = update.message.text || '';
          const contact = update.message.contact;
          
          // أمر start
          if (text === '/start') {
            await sendTelegramMessage(
              env.BOT_TOKEN,
              chatId,
              '👋 مرحباً بك في بوت القصص!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك.',
              {
                reply_markup: {
                  keyboard: [[{ text: '📱 مشاركة رقم الهاتف', request_contact: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true
                }
              }
            );
          }
          // استلام جهة الاتصال
          else if (contact) {
            await sendTelegramMessage(
              env.BOT_TOKEN,
              chatId,
              '✅ تم استلام رقم هاتفك: ' + contact.phone_number + '\n\n📋 طلبك قيد التحقق.\n\nيمكنك الآن تصفح المحتوى.'
            );
          }
          // أي رسالة أخرى
          else {
            await sendTelegramMessage(
              env.BOT_TOKEN,
              chatId,
              'مرحباً! استخدم /start للبدء.'
            );
          }
        }
        
        return new Response('OK', { status: 200 });
        
      } catch (error) {
        console.error('Error:', error.message);
        return new Response('Error: ' + error.message, { status: 200 });
      }
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
};

// دالة مساعدة لإرسال الرسائل
async function sendTelegramMessage(token, chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: text,
    ...extra
  });
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  });
}
