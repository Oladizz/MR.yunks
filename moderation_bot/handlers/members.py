from telegram import Update
from telegram.ext import CallbackContext
from telegram.constants import ChatMemberStatus
import structlog

logger = structlog.get_logger(__name__)

def _extract_status_change(chat_member_update):
    """Takes a ChatMemberUpdated instance and extracts whether the user was added
    and if they are a new member."""
    status_change = chat_member_update.difference().get("status")
    if status_change is None:
        return None, None

    old_status, new_status = status_change
    was_member = old_status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR]
    is_member = new_status in [ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR]

    return was_member, is_member

async def welcome_new_member(update: Update, context: CallbackContext) -> None:
    """Greets new users when they join the chat and displays a welcome message."""
    result = _extract_status_change(update.chat_member)
    if result is None:
        return

    was_member, is_member = result

    if not was_member and is_member:
        new_member = update.chat_member.new_chat_member.user
        
        custom_welcome_message = context.chat_data.get('welcome_message')
        if custom_welcome_message:
            # Replace placeholder if present
            welcome_text = custom_welcome_message.format(username=new_member.mention_html())
        else:
            # Default welcome message (adapted from Node.js bot)
            welcome_text = (
                f"Yoh-koh-so, {new_member.mention_html()}! ☠️\n\n"
                "Cult’s runes have spoken, the spirits nods rituals initiated\n\n"
                "Prove your devotion… the Cult watches. 👁️"
            )
            
        await update.effective_chat.send_message(welcome_text, parse_mode='HTML')
        logger.info("Welcomed new member", user_id=new_member.id, chat_id=update.effective_chat.id)
