// ========== دوال المستخدم ==========

async function handleUserSelection(chatId, text, token) {
  // معالجة الأزرار الثابتة
  if (text === 'ℹ️ عن البوت') {
    return sendMessage(chatId, 
      '📌 بوت القصص والمقاطع\nالإصدار 2.0\nللتواصل: @jahab',
      token
    );
  }
  
  if (text === '🆘 مساعدة') {
    return sendMessage(chatId, 
      '🆘 للمساعدة:\n• استخدم الأزرار للتنقل\n• اختر القسم المناسب\n• للتواصل: @jahab',
      token
    );
  }

  // ===== التحقق من الأقسام المباشرة =====
  // البحث في جميع الأقسام عن تطابق مع النص المرسل
  for (const [categoryName, categoryData] of Object.entries(categories.structure)) {
    // التحقق من أن القسم مباشر وأن النص يطابق اسم القسم
    if (categoryData.type === 'direct' && categoryName === text) {
      const content = categoryData.content || '⚠️ هذا القسم فارغ حالياً';
      return sendMessage(chatId, content, token, { parse_mode: 'HTML' });
    }
  }

  // ===== البحث في المجلدات =====
  // إذا كان النص يطابق اسم مجلد، نعرض محتوياته
  for (const [folderName, folderData] of Object.entries(categories.structure)) {
    if (folderData.type === 'folder' && folderName === text) {
      const children = folderData.children || [];
      
      if (children.length === 0) {
        return sendMessage(chatId, `📁 "${folderName}" فارغ حالياً`, token);
      }

      const buttons = children.map(child => {
        const childData = categories.structure[child];
        if (childData && childData.type === 'direct') {
          return [{ text: `📄 ${child}`, callback_data: `direct_${child}` }];
        } else if (childData && childData.type === 'folder') {
          return [{ text: `📁 ${child}`, callback_data: `folder_${child}` }];
        }
        return null;
      }).filter(Boolean);

      buttons.push([{ text: '🔙 رجوع', callback_data: 'back_to_menu' }]);

      return sendMessage(chatId, `📁 محتويات "${folderName}":`, token, {
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }

  // إذا لم يتم العثور على أي تطابق
  return sendMessage(chatId, 'استخدم الأزرار للتنقل في البوت', token);
}
