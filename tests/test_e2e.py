import pytest
import asyncio
from unittest.mock import AsyncMock

from moderation_bot.main import start
from moderation_bot.handlers.moderation import ban_user

@pytest.mark.asyncio
async def test_start_command_e2e():
    """
    E2E-like test for the /start command.
    """
    update = AsyncMock()
    context = AsyncMock()
    
    await start(update, context)
    
    update.message.reply_text.assert_awaited_once_with(
        "Moderation bot started. Add me to a group to begin."
    )

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
