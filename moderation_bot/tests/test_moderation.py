import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from ..handlers.moderation import warn_user, kick_user, ban_user, unban_user

# --- Tests for /warn ---

@pytest.mark.asyncio
async def test_warn_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    warned_user = MagicMock()
    warned_user.mention_html.return_value = "WarnedUser"
    update.message.reply_to_message.from_user = warned_user
    context.args = ["for", "spamming"]

    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await warn_user(update, context)
        update.message.reply_html.assert_called_once()
        call_args, _ = update.message.reply_html.call_args
        assert "<b>Reason:</b> for spamming" in call_args[0]

@pytest.mark.asyncio
async def test_warn_user_as_non_admin():
    update = AsyncMock()
    context = AsyncMock()
    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=False)):
        await warn_user(update, context)
        update.message.reply_text.assert_called_once_with("This command can only be used by admins.")

# --- Tests for /kick ---

@pytest.mark.asyncio
async def test_kick_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    kicked_user = MagicMock()
    kicked_user.mention_html.return_value = "KickedUser"
    update.message.reply_to_message.from_user = kicked_user

    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await kick_user(update, context)
        context.bot.kick_chat_member.assert_called_once_with(update.effective_chat.id, kicked_user.id)

# --- Tests for /ban ---

@pytest.mark.asyncio
async def test_ban_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    banned_user = MagicMock()
    banned_user.mention_html.return_value = "BannedUser"
    update.message.reply_to_message.from_user = banned_user

    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await ban_user(update, context)
        context.bot.ban_chat_member.assert_called_once_with(update.effective_chat.id, banned_user.id)

# --- Tests for /unban ---

@pytest.mark.asyncio
async def test_unban_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    context.args = ["12345"]

    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await unban_user(update, context)
        context.bot.unban_chat_member.assert_called_once_with(update.effective_chat.id, 12345)
        update.message.reply_text.assert_called_once_with("✅ User 12345 has been unbanned.")

@pytest.mark.asyncio
async def test_unban_user_without_id():
    update = AsyncMock()
    context = AsyncMock()
    context.args = []

    with patch('handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await unban_user(update, context)
        update.message.reply_text.assert_called_once_with("Please provide a valid user ID to unban. Usage: /unban <user_id>")
