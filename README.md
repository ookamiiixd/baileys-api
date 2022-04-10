# Baileys API

An implementation of [@adiwajshing/Baileys](https://github.com/adiwajshing/Baileys) as a simple RESTful API service with multiple device support. This project implements both **Legacy** (Normal WhatsApp Web) and **Beta Multi-Device** client so that you can choose and use one of them easily.

## Requirements

-   **NodeJS** version **14.5.0** or higher.

## Installation

1. Download or clone this repo.
2. Enter to the project directory.
3. Install the dependencies.

## `.env` Configurations

```env
# Listening Host
HOST=127.0.0.1

# Listening Port
PORT=8000

# Maximum Reconnect Attempts
MAX_RETRIES=5

# Reconnect Interval (in Milliseconds)
RECONNECT_INTERVAL=5000
```

## Usage

1. You can start the app by executing `npm run start` or `node .`.
2. Now the endpoint should be available according to your environment variable configurations. Default is at `http://localhost:8000`.

## API Docs

The API documentation is available online [here](https://documenter.getpostman.com/view/18988925/UVeNni36). You can also import the **Postman Collection File** `(postman_collection.json)` into your Postman App alternatively.

The server will respond in following JSON format:

```javascript
{
    success: true|false, // bool
    message: "", // string
    data: {}|[] // object or array of object
}
```

## Known Issue

-   ~~Logging out from your phone manually when the session is still active **will kill the entire app** after a few minutes. As for now you should only destroy a session by using the **delete session endpoint** to avoid this issue. This issue only occurs for **Beta Multi-Device** users~~. This issue should be solved on Baileys version **4.1.0** (Tested).

## Notes

-   The app only provide a very simple validation, you may want to implement your own.
-   There's no authentication, you may want to implement your own.
-   The **Beta Multi-Device** client use provided Baileys's `makeInMemoryStore` method which will store your data in memory and a json file, you may want to use a better data management.
-   Automatically reading incoming messages is now disabled by default. Uncomment `whatsapp.js:91-105` to enable this behaviour.
-   If you have problems when deploying on **CPanel** or any other similar hosting, transpiling your code into **CommonJS** should fix the problems.

## Notice

This project is intended for learning purpose only, don't use it for spamming or any activities that's prohibited by **WhatsApp**.
