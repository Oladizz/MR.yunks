# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy the requirements file first to leverage Docker cache
COPY moderation_bot/requirements.txt ./moderation_bot/requirements.txt

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r moderation_bot/requirements.txt

# Copy the rest of the application
COPY . .

# Set the command to run the application
CMD ["python", "-m", "moderation_bot.main"]
