export default {
  async fetch(request, env) {

    if (request.method !== "POST") {
      return new Response("Bot is running");
    }

    const update = await request.json();

    if (!update.message) {
      return new Response("ok");
    }

    const message = update.message;
    const chatId = message.chat.id;

    if (message.text === "/start") {

      await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: "مرحباً بك 👋\n\nللمتابعة يجب مشاركة رقم هاتفك.",
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "📱 مشاركة رقم الهاتف",
                    request_contact: true
                  }
                ]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          })
        }
      );

    }

    return new Response("ok");
  }
}
