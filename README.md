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

### ``GET /chats/get?session=:sessionID``
This endpoint will return list of your personal chats.

**Parameters**
+ ``session`` The session ID that already created.
---

### ``POST /chats/send``
This endpoint used to send a personal text message.

**Parameters**
+ ``sender`` The session ID that already created.
+ ``receiver`` The receiver phone number in format: ``[country  code without +][phone number]``. Example: ``6282314597xxx``.
+ ``message`` The message.

---

### ``GET /groups/get?session=:sessionID``
This endpoint will return list of your groups.

**Parameters**
+ ``session`` The session ID that already created.
---

### ``POST /groups/send``
This endpoint used to send a text message to a group.

**Parameters**
+ ``sender`` The session ID that already created.
+ ``receiver`` The group ID. Example: ``6282314597xxx-42674242``.
+ ``message`` The message.

---

The server will respond in format:
```javascript
{
    success: true|false,
    message: "",
    data: {}
}
```

## Notice
This project is intended for learning purpose only, don't use this for spam or any activities that prohibited by **WhatsApp**.