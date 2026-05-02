const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const axios = require("axios");
const logger = require("./src/utils/logger");
require("dotenv").config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Singleton Browser ──────────────────────────────────────────────────────────

let browserInstance = null;
let isProcessing = false;
const requestQueue = [];

function isBrowserAlive() {
  try {
    return browserInstance !== null && browserInstance.isConnected();
  } catch (_) {
    return false;
  }
}

async function getBrowser() {
  if (isBrowserAlive()) return browserInstance;

  logger.info("LAUNCH BROWSER BARU");
  const userDataDir = path.resolve(__dirname, "UserData");

  browserInstance = await puppeteer.launch({
    headless: false,
    userDataDir,
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--lang=en-US,en",
    ],
    defaultViewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
  });

  browserInstance.on("targetcreated", async (target) => {
    try {
      const newPage = await target.page();
      if (!newPage) return;
      await newPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
        window.chrome = {
          runtime: {},
          loadTimes: function () {},
          csi: function () {},
          app: {},
        };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
      });
    } catch (_) {}
  });

  browserInstance.on("disconnected", () => {
    logger.warn("BROWSER TERPUTUS, INSTANCE DIRESET");
    browserInstance = null;
  });

  return browserInstance;
}

async function applyStealthToPage(page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    window.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {},
    };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
}

async function getActivePage() {
  const browser = await getBrowser();
  const pages = await browser.pages();

  if (pages.length > 1) {
    logger.info(`MENUTUP ${pages.length - 1} TAB LAMA`);
    for (let i = 0; i < pages.length - 1; i++) {
      await pages[i].close().catch(() => {});
    }
  }

  const page = (await browser.pages())[0];
  await applyStealthToPage(page);
  return page;
}

function hasUserData() {
  const userDataDir = path.resolve(__dirname, "UserData");
  try {
    return fs.existsSync(userDataDir) && fs.readdirSync(userDataDir).length > 0;
  } catch (_) {
    return false;
  }
}

// ── Request Queue ──────────────────────────────────────────────────────────────

function enqueueRequest(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;
  const { fn, resolve, reject } = requestQueue.shift();

  try {
    const result = await fn();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    isProcessing = false;
    processQueue();
  }
}

// ── Core Logic ─────────────────────────────────────────────────────────────────

async function _verifyGoogleForGetCode(email, password, clientId) {
  const urlRedirect = process.env.urlRedirect;
  const scopeApp = process.env.scopeApp;

  const loginUrl = `https://accounts.google.com/o/oauth2/auth?redirect_uri=${urlRedirect}&prompt=consent&response_type=code&client_id=${clientId}&scope=${scopeApp}&access_type=offline&service=lso&o2v=2&flowName=GeneralOAuthFlow`;
  logger.debug(`Login URL: ${loginUrl}`);

  const page = await getActivePage();

  const clickContinueByXPath = async (pageRef) => {
    try {
      const clicked = await pageRef.evaluate(() => {
        const xpath = "//button[.//span[text()='Continue'] or .//span[text()='Lanjutkan']]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const btn = result.singleNodeValue;
        if (btn) { btn.click(); return true; }
        return false;
      });
      clicked ? logger.debug("TOMBOL CONTINUE BERHASIL DIKLIK") : logger.warn("TOMBOL CONTINUE TIDAK DITEMUKAN");
      return clicked;
    } catch (error) {
      logger.error(`GAGAL KLIK TOMBOL CONTINUE: ${error.message}`);
      return false;
    }
  };

  const readCodeFromFile = () => {
    const result = fs.readFileSync(path.join(__dirname, "config.json"), { encoding: "utf-8" });
    return JSON.parse(result);
  };

  const checkCodeAlreadyReceived = () => {
    try {
      const parsed = readCodeFromFile();
      return parsed.code && parsed.code !== "" ? parsed.code : null;
    } catch (_) {
      return null;
    }
  };

  const continueWithSingleVerif = async (resolve) => {
    await delay(9000);
    logger.debug("CEK APAKAH CHECKBOX ADA...");
    const checkBox = ".VfPpkd-muHVFf-bMcfAe";
    const secondContinue = "#submit_approve_access > div > button";
    try {
      await page.waitForSelector(checkBox, { timeout: 5000 });
      logger.debug("AKSI KLIK CHECKBOX");
      await page.click(checkBox);
      await delay(2000);
      logger.debug("AKSI KLIK CONTINUE APPROVE");
      await page.waitForSelector(secondContinue, { timeout: 5000 });
      await page.click(secondContinue);
      await delay(5000);
      logger.info("AKSI SELESAI — code berhasil didapat");
      resolve(readCodeFromFile());
    } catch (err) {
      logger.debug("CHECKBOX TIDAK DITEMUKAN, LANGSUNG KLIK TOMBOL CONTINUE");
      await clickContinueByXPath(page);
      await delay(7000);
      logger.info("AKSI SELESAI — code berhasil didapat");
      resolve(readCodeFromFile());
    }
  };

  const continueWithDoubleVerif = async (resolve) => {
    await delay(9000);
    logger.debug("AKSI KLIK CONTINUE AGAIN");
    const continueButtonAgain =
      "#yDmH0d > c-wiz > div > div.JYXaTc.F8PBrb > div > div > div:nth-child(2) > div > div > button > div.VfPpkd-RLmnJb";
    try {
      await page.waitForSelector(continueButtonAgain, { timeout: 8000 });
      await page.click(continueButtonAgain);
    } catch (e) {
      logger.warn("TOMBOL CONTINUE AGAIN TIDAK DITEMUKAN, LANJUT...");
    }
    await continueWithSingleVerif(resolve);
  };

  const handleAccountChooser = async () => {
    try {
      await delay(2000);
      const isAccountChooser = await page.evaluate(() =>
        window.location.href.includes("accountchooser") ||
        !!document.querySelector("[data-identifier]") ||
        !!document.querySelector(".w6VTHd")
      );
      if (!isAccountChooser) { logger.debug("HALAMAN ACCOUNT CHOOSER TIDAK TERDETEKSI"); return; }

      logger.info("HALAMAN ACCOUNT CHOOSER TERDETEKSI");
      const clicked = await page.evaluate((targetEmail) => {
        const items = document.querySelectorAll("[data-identifier]");
        for (const item of items) {
          if ((item.getAttribute("data-identifier") || "").toLowerCase() === targetEmail.toLowerCase()) {
            item.click(); return true;
          }
        }
        return false;
      }, email);

      if (clicked) {
        logger.info(`AKUN DITEMUKAN DAN DIKLIK: ${email}`);
      } else {
        logger.info(`AKUN ${email} TIDAK ADA DI CHOOSER, KLIK "USE ANOTHER ACCOUNT"`);
        const usedAnother = await page.evaluate(() => {
          const allItems = document.querySelectorAll("li[data-authuser]");
          for (const item of allItems) {
            if (!item.getAttribute("data-identifier")) { item.click(); return true; }
          }
          const xpath = "//*[contains(text(),'Use another account') or contains(text(),'Gunakan akun lain')]";
          const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (el) { el.click(); return true; }
          return false;
        });
        if (!usedAnother) logger.warn("TOMBOL 'USE ANOTHER ACCOUNT' TIDAK DITEMUKAN");
      }
      await delay(3000);
    } catch (err) {
      logger.warn(`HANDLE ACCOUNT CHOOSER ERROR: ${err.message}`);
    }
  };

  const handleUnverifiedAppWarning = async () => {
    try {
      await delay(2000);
      const isWarning = await page.evaluate(() => window.location.href.includes("/signin/oauth/warning"));
      if (!isWarning) { logger.debug("HALAMAN WARNING APP TIDAK TERDETEKSI"); return; }

      logger.info("HALAMAN 'GOOGLE HASN'T VERIFIED THIS APP' TERDETEKSI");
      const clicked = await page.evaluate(() => {
        const xpath = "//button[.//span[@class='VfPpkd-vQzf8d' and (text()='Continue' or text()='Lanjutkan')]]";
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return true; }
        return false;
      });
      if (clicked) { logger.info("TOMBOL 'CONTINUE' DI HALAMAN WARNING BERHASIL DIKLIK"); await delay(3000); }
      else logger.warn("TOMBOL 'CONTINUE' DI HALAMAN WARNING TIDAK DITEMUKAN");
    } catch (err) {
      logger.warn(`HANDLE WARNING APP ERROR: ${err.message}`);
    }
  };

  const handleSigningBackIn = async () => {
    try {
      await delay(2000);
      const isSigningBackIn = await page.evaluate(() => window.location.href.includes("/signin/oauth/id"));
      if (!isSigningBackIn) { logger.debug("HALAMAN 'SIGNING BACK IN' TIDAK TERDETEKSI"); return; }

      logger.info("HALAMAN 'YOU'RE SIGNING BACK IN' TERDETEKSI");
      const clicked = await page.evaluate(() => {
        const xpath = "//button[.//span[@class='VfPpkd-vQzf8d' and (text()='Continue' or text()='Lanjutkan')]]";
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return true; }
        return false;
      });
      if (clicked) { logger.info("TOMBOL 'CONTINUE' DI HALAMAN SIGNING BACK IN BERHASIL DIKLIK"); await delay(3000); }
      else logger.warn("TOMBOL 'CONTINUE' DI HALAMAN SIGNING BACK IN TIDAK DITEMUKAN");
    } catch (err) {
      logger.warn(`HANDLE SIGNING BACK IN ERROR: ${err.message}`);
    }
  };

  const handleConsentSummary = async () => {
    try {
      await delay(2000);
      const isConsentSummary = await page.evaluate(() => window.location.href.includes("/signin/oauth/v2/consentsummary"));
      if (!isConsentSummary) { logger.debug("HALAMAN 'CONSENT SUMMARY' TIDAK TERDETEKSI"); return; }

      logger.info("HALAMAN 'WANTS ACCESS TO YOUR GOOGLE ACCOUNT' TERDETEKSI");
      const clicked = await page.evaluate(() => {
        const xpath = "//button[.//span[@class='VfPpkd-vQzf8d' and (text()='Continue' or text()='Lanjutkan')]]";
        const el = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (el) { el.click(); return true; }
        return false;
      });
      if (clicked) { logger.info("TOMBOL 'CONTINUE' DI HALAMAN CONSENT SUMMARY BERHASIL DIKLIK"); await delay(3000); }
      else logger.warn("TOMBOL 'CONTINUE' DI HALAMAN CONSENT SUMMARY TIDAK DITEMUKAN");
    } catch (err) {
      logger.warn(`HANDLE CONSENT SUMMARY ERROR: ${err.message}`);
    }
  };

  const handleSigninRejected = async () => {
    try {
      await delay(2000);
      const isRejected = await page.evaluate(() =>
        window.location.href.includes("/signin/rejected") ||
        window.location.href.includes("signin/rejected")
      );
      if (!isRejected) { logger.debug("HALAMAN 'SIGNIN REJECTED' TIDAK TERDETEKSI"); return false; }

      logger.warn("HALAMAN 'COULDN'T SIGN YOU IN' TERDETEKSI — MENCOBA ULANG DENGAN CLEAR SESSION");
      const cookies = await page.cookies();
      if (cookies.length > 0) await page.deleteCookie(...cookies);
      await page.evaluate(() => {
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
      });
      await delay(2000);
      return true;
    } catch (err) {
      logger.warn(`HANDLE SIGNIN REJECTED ERROR: ${err.message}`);
      return false;
    }
  };

  logger.info("NAVIGASI KE LOGIN URL");
  fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify({ code: "" }));
  await page.goto(loginUrl, { waitUntil: "networkidle2" });

  const wasRejected = await handleSigninRejected();
  if (wasRejected) {
    logger.info("RETRY NAVIGASI KE LOGIN URL SETELAH CLEAR SESSION");
    await page.goto(loginUrl, { waitUntil: "networkidle2" });
  }

  const userDataExists = hasUserData();
  logger.info(`CEK USER DATA: ${userDataExists ? "ADA — alur account chooser" : "TIDAK ADA — alur input email/password"}`);

  if (userDataExists) {
    await handleAccountChooser();
    await handleUnverifiedAppWarning();
    await handleSigningBackIn();
    await handleConsentSummary();

    await delay(3000);
    const earlyCode = checkCodeAlreadyReceived();
    if (earlyCode) {
      logger.info("CODE SUDAH DITERIMA (ALUR SESSION AKTIF), SELESAI");
      return earlyCode;
    }
    logger.info("CODE BELUM DITERIMA, LANJUT KE ALUR INPUT EMAIL/PASSWORD");
  }

  const resultVerifyGoogle = await new Promise(async (resolve, reject) => {
    try {
      logger.info("AKSI INPUT EMAIL + ENTER");
      await page.waitForSelector("input[type='email']", { timeout: 15000 });
      await page.type("input[type='email']", email);
      await page.keyboard.press("Enter");

      await delay(8000);
      
      // ── HANDLE CAPTCHA ──────────────────────────────────────────────────────
      logger.info("CEK APAKAH ADA CAPTCHA...");
      const hasCaptcha = await page.evaluate(() => {
        // Cek berbagai indikator captcha
        const captchaIndicators = [
          document.querySelector("input[aria-label*='Type the text you hear or see']"),
          document.querySelector("input[placeholder*='Type the text']"),
          document.querySelector("textarea[aria-label*='Type the text']"),
          document.querySelector(".VfPpkd-t08AT-Bz112c-M1sQAe"), // Captcha container
          document.querySelector("img[alt*='CAPTCHA']"),
          document.querySelector("div[data-captcha-id]"),
        ];
        return captchaIndicators.some(el => el !== null);
      });

      if (hasCaptcha) {
        logger.warn("CAPTCHA TERDETEKSI — MENUNGGU USER INPUT CAPTCHA DAN KLIK NEXT");
        
        // Tunggu hingga user menginput captcha dan menekan tombol Next
        try {
          await page.waitForFunction(
            () => {
              // Cek apakah halaman sudah berubah (redirect atau URL berubah)
              // atau tombol Next sudah diklik dan halaman loading
              const currentUrl = window.location.href;
              const isStillOnCaptchaPage = currentUrl.includes("/signin") && 
                                         !currentUrl.includes("/challenge/");
              return !isStillOnCaptchaPage;
            },
            { timeout: 300000, polling: 2000 } // 5 menit timeout
          );
          logger.info("CAPTCHA SELESAI — USER SUDAH MENGINPUT DAN KLIK NEXT");
          await delay(3000);
        } catch (captchaTimeoutErr) {
          logger.error("TIMEOUT MENUNGGU CAPTCHA (5 menit) — USER TIDAK MENGINPUT CAPTCHA");
          reject(new Error("CAPTCHA_TIMEOUT"));
          return;
        }
      } else {
        logger.info("CAPTCHA TIDAK TERDETEKSI — LANJUT KE INPUT PASSWORD");
      }

      logger.info("AKSI INPUT PASSWORD + ENTER");
      await page.waitForSelector("input[type='password']", { timeout: 15000 });
      await page.type("input[type='password']", password);
      await page.keyboard.press("Enter");

      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
      } catch (_) {
        logger.debug("waitForNavigation setelah password timeout/tidak diperlukan, lanjut...");
      }

      let isRejectedAfterPassword = false;
      try {
        isRejectedAfterPassword = await page.evaluate(() =>
          window.location.href.includes("/signin/rejected")
        );
      } catch (evalErr) {
        logger.warn(`CEK REJECTED SETELAH PASSWORD GAGAL (navigation): ${evalErr.message}`);
      }
      if (isRejectedAfterPassword) {
        logger.error("GOOGLE MENOLAK LOGIN SETELAH INPUT PASSWORD — BROWSER TERDETEKSI SEBAGAI BOT");
        reject(new Error("FAILED_GET_CODE"));
        return;
      }

      const isTwoStepVerif = await page.evaluate(() =>
        window.location.href.includes("/signin/challenge/")
      );

      if (isTwoStepVerif) {
        logger.warn("HALAMAN 2-STEP VERIFICATION TERDETEKSI");

        // Coba klik opsi "Tap Yes" (selection page) jika muncul
        const clickedYesOption = await page.evaluate(() => {
          // Cari semua list item / div yang mengandung teks "Tap Yes" atau "Yes"
          const xpathPatterns = [
            "//*[contains(text(),'Tap Yes on the device your recovery email')]",
            "//*[contains(text(),'Tap Yes on your phone or tablet')]",
            "//*[contains(text(),'Tap Yes')]",
          ];
          for (const xpath of xpathPatterns) {
            const result = document.evaluate(
              xpath, document, null,
              XPathResult.FIRST_ORDERED_NODE_TYPE, null
            );
            const el = result.singleNodeValue;
            if (el) {
              // Klik elemen atau parent yang bisa diklik
              const clickable = el.closest("li") || el.closest("[role='link']") ||
                                el.closest("[role='button']") || el.closest("a") || el;
              clickable.click();
              return true;
            }
          }
          return false;
        });

        if (clickedYesOption) {
          logger.info("OPSI 'TAP YES' BERHASIL DIKLIK — MENUNGGU KONFIRMASI DI HP...");
        } else {
          logger.warn("OPSI 'TAP YES' TIDAK DITEMUKAN — MENUNGGU KONFIRMASI MANUAL DI HP...");
        }

        try {
          await page.waitForFunction(
            () => !window.location.href.includes("/signin/challenge/"),
            { timeout: 120000, polling: 1500 }
          );
          logger.info("HALAMAN 2-STEP VERIFICATION SELESAI — HALAMAN SUDAH REDIRECT");
          await delay(3000);
        } catch (waitErr) {
          logger.error("TIMEOUT MENUNGGU 2-STEP VERIFICATION (120 detik)");
          reject(new Error("FAILED_GET_CODE"));
          return;
        }
      }

      logger.info("AKSI KLIK CONTINUE");

      const continueButtonSelectors = [
        ".VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.ksBjEc.lKxP2d.LQeN7.uRo0Xe.TrZEUc.lw1w4b",
        ".VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-dgl2Hf.ksBjEc.lKxP2d.LQeN7.BqKGqe.eR0mzb.TrZEUc.lw1w4b",
      ];

      let clicked = false;
      for (const selector of continueButtonSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          clicked = true;
          logger.debug(`TOMBOL CONTINUE DIKLIK: ${selector}`);
          break;
        } catch (e) {
          logger.debug(`SELECTOR TIDAK DITEMUKAN: ${selector}`);
        }
      }
      if (!clicked) {
        logger.warn("SEMUA SELECTOR GAGAL, COBA KLIK VIA XPATH");
        await clickContinueByXPath(page);
      }

      await delay(3000);
      logger.debug("AKSI CEK ELEMENT LANJUTAN");

      const selectorElement =
        "#yDmH0d > c-wiz > div > div.JYXaTc.F8PBrb > div > div > div:nth-child(2) > div > div > button > div.VfPpkd-RLmnJb";
      const availableElement = await page.$(selectorElement);

      if (availableElement) {
        logger.info("ELEMENT LANJUTAN TERDETEKSI — DOUBLE VERIF");
        await delay(3000);
        await clickContinueByXPath(page);
        await continueWithDoubleVerif(resolve);
      } else {
        logger.info("ELEMENT LANJUTAN TIDAK TERDETEKSI — SINGLE VERIF");
        await delay(3000);
        await clickContinueByXPath(page);
        await continueWithSingleVerif(resolve);
      }
    } catch (error) {
      logger.error(`ERROR DI ALUR UTAMA: ${error.message}`);
      reject(error);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(resultVerifyGoogle, "code") || resultVerifyGoogle.code === "") {
    throw new Error("FAILED_GET_CODE");
  }

  return resultVerifyGoogle.code;
}

// ── Public API ─────────────────────────────────────────────────────────────────

const verifyGoogleForGetCode = (email, password, clientId) => {
  logger.info(`REQUEST MASUK ANTRIAN — email: ${email} | antrian: ${requestQueue.length + (isProcessing ? 1 : 0)}`);
  return enqueueRequest(() => _verifyGoogleForGetCode(email, password, clientId));
};

const verifyGoogleForGetToken = async (code, clientId, clientSecret) => {
  try {
    logger.info("AKSI MENGAMBIL TOKEN");

    const requestBody = querystring.stringify({
      code: code,
      redirect_uri: process.env.urlRedirect,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
    });

    const response = await axios.post(
      process.env.tokenUri,
      requestBody,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    logger.info("TOKEN BERHASIL DIDAPAT");
    return response.data;
  } catch (error) {
    logger.error(`ERROR SAAT MENGAMBIL TOKEN: ${error.response?.data?.error_description || error.message}`);
    throw new Error(error.response?.data?.error_description || error.message);
  }
};

module.exports = {
  verifyGoogleForGetCode,
  verifyGoogleForGetToken,
};
