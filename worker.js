export default {
  async fetch(request, env) {
    if (request.method === 'POST') {
      const update = await request.json();
      
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const contact = update.message.contact;
        
        if (text === '/start') {
          await this.sendMessage(env.BOT_TOKEN, chatId, 
            '👋 مرحباً بك!\n\nللتحقق من هويتك، يرجى مشاركة رقم هاتفك بالضغط على الزر أدناه.',
            {
              reply_markup: {
                keyboard: [[{
                  text: '📱 مشاركة رقم الهاتف',
                  request_contact: true
                }]],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            }
          );
        }
        else if (contact) {
          await this.sendMessage(env.BOT_TOKEN, chatId,
            '✅ تم استلام رقم هاتفك: ' + contact.phone_number + '\n\n📋 طلبك قيد التحقق حالياً.\nسنقوم بالتواصل معك قريباً.'
          );
          
          if (env.ADMIN_CHAT_ID) {
            await this.sendMessage(env.BOT_TOKEN, env.ADMIN_CHAT_ID,
              '🔔 مستخدم جديد:\nالاسم: ' + contact.first_name + (contact.last_name ? ' ' + contact.last_name : '') + '\nالهاتف: ' + contact.phone_number + '\nالمعرف: ' + chatId
            );
          }
        }
      }
      
      return new Response('OK');
    }
    return new Response('Bot is running');
  },
  
  async sendMessage(token, chatId, text, extra = {}) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = { chat_id: chatId, text: text, ...extra };
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
};
