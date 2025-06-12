const host = process.env.HOST || "ikuuu.one";

const protocolPrefix = "https://";
const logInUrl = `${protocolPrefix}${host}/auth/login`;
const checkInUrl = `${protocolPrefix}${host}/user/checkin`;

function parseCookie(rawCookie) {
  let cookieSets = rawCookie.split("path=/,");

  // 用于存储去重后的Cookie键值对
  const cookies = {};

  // 遍历 cookieSets 数组
  cookieSets.forEach((cookie) => {
    // 利用正则表达式提取字段名和字段值
    const match = cookie.match(/^([^=]+)=(.*?);/);
    if (match) {
      const fieldName = match[1].trim();
      let fieldValue = match[2].trim();

      // 对字段值进行解码
      fieldValue = decodeURIComponent(fieldValue);

      // 存储到cookies对象中（确保每个字段只有一个值，即去重）
      if (!cookies[fieldName]) {
        cookies[fieldName] = fieldValue;
      }
    }
  });

  return cookies;
}

function generateCookieStr(cookieObject) {
  // 将对象转换为Cookie格式的字符串
  return Object.entries(cookieObject)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("; ");
}

async function logIn(email, passwd) {
  console.log("Loging in...");

  let formData = new FormData();
  formData.append("host", host);
  formData.append("email", email);
  formData.append("passwd", passwd);
  formData.append("code", "");
  formData.append("remember_me", "off");

  let response = await fetch(logInUrl, {
    method: "POST",
    body: formData,
  });

  let rawCookie = response.headers.get("set-cookie");

  let responseJson = await response.json();

  return { msg: responseJson.msg, cookie: parseCookie(rawCookie) };
}

async function checkIn(cookie) {
  const response = await fetch(checkInUrl, {
    method: "POST",
    headers: {
      Cookie: generateCookieStr(cookie),
    },
  });
  const resJson = await response.json();
  return resJson.msg;
}

async function sendTelegramMessage(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram bot token or chat ID not found in environment variables.");
    return;
  }

  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const params = new URLSearchParams({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
  });

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (data.ok) {
      console.log("Telegram notification sent successfully.");
    } else {
      console.error("Failed to send Telegram notification:", data.description);
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
  }
}

async function main() {
  let email;
  let passwd;
  let notificationMessages = [];

  if (process.env.EMAIL && process.env.PASSWD) {
    email = process.env.EMAIL;
    passwd = process.env.PASSWD;
  } else {
    notificationMessages.push("ENV ERROR: EMAIL or PASSWD not set.");
    console.log("ENV ERROR");
    process.exit(1);
  }

  try {
    const { msg: loginMsg, cookie } = await logIn(email, passwd);
    notificationMessages.push(`ikuuu登录: ${loginMsg}`);

    const checkinMsg = await checkIn(cookie);
    notificationMessages.push(`签到结果: ${checkinMsg}`);
  } catch (error) {
    notificationMessages.push(`操作失败: ${error.message}`);
    console.error("Operation failed:", error);
  } finally {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const finalMessage = "ikuuu签到\n" + notificationMessages.join("\n");
      await sendTelegramMessage(finalMessage);
    } else {
      console.log("Skipping Telegram notification: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.");
    }
  }
}

main();
