const path = require("path");
const axios = require("axios");

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const port = Number(process.env.PORT || 3001);

const https = require("https");
const http = require("http");
const fs = require("fs");
const app = require("./app");

let server;
console.log(process.env.mode);
if (process.env.mode === "production") {
  server = https.createServer(
    {
      key: fs.readFileSync("ssl/server149.xite.io-key.pem"),
      cert: fs.readFileSync("ssl/server149.xite.io-crt.pem"),
      rejectUnauthorized: false,
    },
    app
  );
} else if (process.env.mode === "development") {
  server = http.createServer(app);
}

server
  .on("error", (err) => {
    console.log(err);
  })
  .listen(port, () => {
    console.log("TableManager: Listening on port:", port);
  });

// reset_ms();
async function reset_ms() {
  try {
    const url = `${process.env.GAME_SERVER}api.php?api=clear_ms&ms=https://${process.env.HOST}:${process.env.PORT}`;
    console.log(`Table Manager service: Notify Reset :${url}`);
    res = await axios.get(url);
    console.log(res.data);

    if (!Boolean(res.data.status ?? false)) {
      console.log(`Table Manager service: Notify Reset: Failed.`);
      return { status: false };
    }

    console.log(`Table Manager service: Notify Reset: Success`);

    return { status: true };
  } catch (err) {
    console.log(`Table Manager service: Notify Reset Error : ${err}`);
  }
}
