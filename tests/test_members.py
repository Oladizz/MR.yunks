import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram.constants import ChatMemberStatus
import re

# Since we are testing a file from the parent directory, we need to add it to the path
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from moderation_bot.handlers.members import welcome_new_member

@pytest.mark.asyncio
async def test_welcome_new_member():
    """Test that a welcome message is sent when a new user joins."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {} # Simulating empty chat_data for default message

    new_member_user = MagicMock()
    new_member_user.mention_html.return_value = "NewUser"
    
    update.chat_member.new_chat_member.user = new_member_user
    update.chat_member.difference = MagicMock(return_value={"status": (ChatMemberStatus.LEFT, ChatMemberStatus.MEMBER)})

    # Mock random.choice to return a predictable initiate name
    with patch('random.choice', return_value="TestInitiateName"):
        await welcome_new_member(update, context)

    expected_welcome_text_pattern = (
        r"Yoh-koh-so, NewUser! ☠️\n\n"
        r"Cult’s runes have spoken, the spirits nods rituals initiated\n\n"
        r"Your initiate name is: TestInitiateName 🔮\n\n"
        r"Prove your devotion… the Cult watches. 👁️"
    )
    
    update.effective_chat.send_message.assert_called_once()
    actual_message = update.effective_chat.send_message.call_args[0][0]
    assert re.fullmatch(expected_welcome_text_pattern, actual_message)
    assert update.effective_chat.send_message.call_args[1]['parse_mode'] == 'HTML'

@pytest.mark.asyncio
async def test_no_welcome_for_existing_member():
    """Test that no message is sent for existing members' status changes."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {} # Simulating empty chat_data for no welcome message

    update.chat_member.difference = MagicMock(return_value={"status": (ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR)})

    await welcome_new_member(update, context)

    update.effective_chat.send_message.assert_not_called()

@pytest.mark.asyncio
async def test_welcome_new_member_custom_message():
    """Test that a custom welcome message is sent if configured."""
    update = AsyncMock()
    context = AsyncMock()

    new_member_user = MagicMock()
    new_member_user.mention_html.return_value = "CustomUser"
    
    update.chat_member.new_chat_member.user = new_member_user
    update.chat_member.difference = MagicMock(return_value={"status": (ChatMemberStatus.LEFT, ChatMemberStatus.MEMBER)})

    context.chat_data = {'welcome_message': 'Hello, {username}! Welcome aboard!'}

    await welcome_new_member(update, context)

    update.effective_chat.send_message.assert_called_once_with(
        "Hello, CustomUser! Welcome aboard!",
        parse_mode='HTML'
    )

@pytest.mark.asyncio
async def test_welcome_new_member_with_initiate_name():
    """Test that a welcome message with initiate name is sent when a new user joins."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {} # Simulating empty chat_data for default message

    new_member_user = MagicMock()
    new_member_user.mention_html.return_value = "NewUser"
    
    update.chat_member.new_chat_member.user = new_member_user
    update.chat_member.difference = MagicMock(return_value={"status": (ChatMemberStatus.LEFT, ChatMemberStatus.MEMBER)})

    # Mock random.choice to return a predictable initiate name
    with patch('random.choice', return_value="TestInitiateName"):
        await welcome_new_member(update, context)

    expected_welcome_text_pattern = (
        r"Yoh-koh-so, NewUser! ☠️\n\n"
        r"Cult’s runes have spoken, the spirits nods rituals initiated\n\n"
        r"Your initiate name is: TestInitiateName 🔮\n\n"
        r"Prove your devotion… the Cult watches. 👁️"
    )
    
    # Assert that the message contains the expected pattern
    update.effective_chat.send_message.assert_called_once()
    actual_message = update.effective_chat.send_message.call_args[0][0]
    assert re.fullmatch(expected_welcome_text_pattern, actual_message) # Using re.fullmatch for exact match
    assert update.effective_chat.send_message.call_args[1]['parse_mode'] == 'HTML'
