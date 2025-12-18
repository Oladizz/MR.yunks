import pytest
import asyncio
from unittest.mock import AsyncMock

from moderation_bot.main import start
from moderation_bot.handlers.moderation import ban_user

@pytest.mark.asyncio
async def test_start_command_e2e_dm():
    """
    E2E-like test for the /start command in a DM.
    """
    update = AsyncMock()
    context = AsyncMock()
    update.effective_chat.type = "private"
    
    await start(update, context)
    
    expected_message = (
        "<b>Welcome to the Mr. Yunks Moderation Bot!</b>\n\n"
        "I am here to help you moderate your Telegram groups.\n"
        "To get started, add me to your group and make me an administrator.\n\n"
        "Use the /help command to see a full list of my capabilities and how to use them.\n\n"
        "For bot administrators, you can use commands like /announce directly in this private chat."
    )
    update.message.reply_html.assert_called_once_with(expected_message)

@pytest.mark.asyncio
async def test_ban_command_e2e_non_admin():
    """
    E2E-like test for the /ban command by a non-admin.
    """
    update = AsyncMock()
    context = AsyncMock()
    
    # We have to patch the _is_user_admin check inside the moderation handler
    from unittest.mock import patch
    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=False)):
        await ban_user(update, context)

    # Check that the bot correctly replies with an admin-only message
    update.message.reply_text.assert_awaited_once_with("This command can only be used by admins.")
