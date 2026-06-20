from telegram import Update, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
import os

TOKEN = os.getenv("BOT_TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[KeyboardButton("مشاركة رقم الهاتف", request_contact=True)]]

    await update.message.reply_text(
        "يرجى مشاركة رقم الهاتف للمتابعة",
        reply_markup=ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=True
        )
    )

async def contact_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    menu = [
        ["قصص مضحكة"],
        ["قصص رعب"],
        ["قصص رومنسية"],
        ["قصص عربية"],
        ["مقاطع"],
        ["البحث عبر رمز"]
    ]

    await update.message.reply_text(
        "اختر من القائمة:",
        reply_markup=ReplyKeyboardMarkup(menu, resize_keyboard=True)
    )

app = Application.builder().token(TOKEN).build()

app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.CONTACT, contact_handler))

app.run_polling()
