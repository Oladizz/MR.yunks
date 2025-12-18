import pytest
from unittest.mock import AsyncMock, MagicMock
from telegram.constants import ChatMemberStatus

from ..handlers.members import welcome_new_member

@pytest.mark.asyncio
async def test_welcome_new_member():
    """Test that a welcome message is sent when a new user joins."""
    # 1. Mocks
    update = AsyncMock()
    context = AsyncMock()

    # Simulate a user joining
    new_member_user = MagicMock()
    new_member_user.mention_html.return_value = "NewUser"
    
    update.chat_member.new_chat_member.user = new_member_user
    
    # Mock the status change to represent a non-member becoming a member
    update.chat_member.difference.return_value = {
        "status": (ChatMemberStatus.LEFT, ChatMemberStatus.MEMBER)
    }

    # 2. Call the handler
    await welcome_new_member(update, context)

    # 3. Assertions
    update.effective_chat.send_message.assert_called_once_with(
        "Welcome to the group, NewUser!",
        parse_mode='HTML'
    )

@pytest.mark.asyncio
async def test_no_welcome_for_existing_member():
    """Test that no message is sent for existing members' status changes."""
    update = AsyncMock()
    context = AsyncMock()

    # Simulate an existing member being promoted to admin
    update.chat_member.difference.return_value = {
        "status": (ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR)
    }

    await welcome_new_member(update, context)

    # Assert that no message was sent
    update.effective_chat.send_message.assert_not_called()
