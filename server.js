const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const puppeteerServices = require("./puppeteerService");
const logger = require("./src/utils/logger");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.port || 4000;

app.use(express.json());

// ─── Request Logger Middleware ────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logMsg = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(logMsg);
    } else if (res.statusCode >= 400) {
      logger.warn(logMsg);
    } else {
      logger.info(logMsg);
    }
  });

  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.post("/code", async (req, res) => {
  const { email, password, clientId, clientSecret } = req.body;

  logger.info(`POST /code — email: ${email}, clientId: ${clientId}`);

  if (!email || !password || !clientId || !clientSecret) {
    res.statusCode = 400;
    return res.json({
      status: "fail",
      message: "Gagal, masukkan data dengan benar.",
    });
  }

  try {
    const resultCode = await puppeteerServices.verifyGoogleForGetCode(
      email,
      password,
      clientId
    );

    const resultRefreshToken = await puppeteerServices.verifyGoogleForGetToken(
      resultCode,
      clientId,
      clientSecret
    );

    logger.info(`POST /code — berhasil mendapatkan token untuk email: ${email}`);

    return res.json({
      status: "success",
      data: resultRefreshToken,
    });
  } catch (error) {
    if (error.message === "FAILED_GET_CODE") {
      logger.warn(`POST /code — FAILED_GET_CODE untuk email: ${email}`);
      res.statusCode = 400;
      return res.json({
        status: "fail",
        message: "Gagal saat verifikasi google dan mengambil code.",
      });
    }

    if (error.message === "CAPTCHA_TIMEOUT") {
      logger.warn(`POST /code — CAPTCHA_TIMEOUT untuk email: ${email}`);
      res.statusCode = 400;
      return res.json({
        status: "fail",
        message: "Timeout menunggu input CAPTCHA (5 menit). Silakan coba lagi.",
      });
    }

    logger.error(`POST /code — server error: ${error.message}`, { stack: error.stack });
    res.statusCode = 500;
    return res.json({
      status: "error",
      message: "Terjadi kegagalan pada server.",
    });
  }
});

app.get("/redirect", async (req, res) => {
  const { code } = req.query;

  logger.info(`GET /redirect — code diterima: ${code ? "ada" : "kosong"}`);

  fs.writeFileSync(
    path.join(__dirname, "config.json"),
    JSON.stringify({ code: code || "" })
  );

  return res.json(req.query);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Server berjalan di http://localhost:${PORT}`);
});
