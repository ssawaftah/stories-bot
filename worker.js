export default {
  async fetch(request, env) {

    if (request.method !== "POST") {
      return new Response("Bot is running");
    }

    const update = await request.json();
    const message = update.message;

    if (!message) return new Response("ok");

    const chatId = message.chat.id;

    if (message.text === "/start") {

      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "تيتيمرحباً 👋\nلاستخدام البوت شارك رقمك.",
          reply_markup: {
            keyboard: [[
              { text: "📱 مشاركة الرقم", request_contact: true }
            ]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        })
      });

    }

    return new Response("ok");
  }
}
