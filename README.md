# Baileys API

An implementation of [@adiwajshing/Baileys](https://github.com/adiwajshing/Baileys) as a simple API service with multiple device support.

## Installation

1. Download or clone this repo.
2. Enter to the project directory.
3. Execute ``npm i``.

## Usage
1. Execute ``npm run start``.
2. Now you can access the endpoint from ``http://localhost:8000``.

## Endpoints
### ``GET /``
This endpoint provide an UI to manage your devices.

---

### ``POST /send-message``
This endpoint used to send a text message (*currently only can be used to send a message to a single person*).

**Parameters**
+ ``sender`` The session ID that already created.
+ ``receiver`` The receiver phone number in format: ``[country  code without +][phone number]``.
+ ``message`` The message.

## Notice
This project is intended for learning purpose only. Don't use it for any activities that prohibited by WhatsApp.
