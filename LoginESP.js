const BACKEND_PASS_URL = "https://sso-entry.odx.kz/api/login/password";
const BACKEND_ECP_URL = "https://sso-entry.odx.kz/api/login/ecp";

const urlParams = new URLSearchParams(window.location.search);
const REDIRECT_URI = urlParams.get("redirect_uri");
const STATE = urlParams.get("state");
const CLIENT_ID = urlParams.get("client_id");
const NONCE = urlParams.get("nonce");

console.log("[OIDC] NONCE:", NONCE);

if (!CLIENT_ID || !REDIRECT_URI || !STATE || !NONCE) {
  document.body.innerHTML = "<h1 class='text-red-600 text-center mt-10'>Недостаточно параметров в URL запроса</h1>";
  throw new Error("OIDC параметры отсутствуют");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginPasswordBtn").addEventListener("click", loginWithPassword);
  document.getElementById("loginEcpBtn").addEventListener("click", loginWithEcp);
});

function base64urlToBase64(input) {
  return input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
}

function setStatus(message, isError = false) {
  const el = document.getElementById("status");
  el.innerText = message;
  el.className = isError
    ? "text-center text-sm font-semibold text-red-600"
    : "text-center text-sm font-semibold text-green-600";
}

async function loginWithPassword() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    return setStatus("Введите логин и пароль", true);
  }

  setStatus("Вход по логину...");

  try {
    const resp = await fetch(BACKEND_PASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, client_id: CLIENT_ID }),
    });

    const data = await resp.json();

    if (resp.ok) {
      const redirectUrl = new URL(REDIRECT_URI);
      redirectUrl.searchParams.set("access_token", data.access_token);
      redirectUrl.searchParams.set("id_token", data.id_token);
      redirectUrl.searchParams.set("state", STATE);
      window.location.href = redirectUrl.toString();
    } else {
      setStatus(data.error || "Ошибка входа", true);
    }
  } catch (err) {
    setStatus("Сетевая ошибка: " + err.message, true);
  }
}

async function loginWithEcp() {
  const client = new NCALayerClient();

  setStatus("Подключение к NCALayer...");

  try {
    await client.connect();
  } catch (err) {
    return setStatus("Ошибка подключения: " + err.message, true);
  }

  const decodedNonce = base64urlToBase64(NONCE);
  setStatus("Подписание данных...");

  try {
    let signed = await client.basicsSignCMS(
      NCALayerClient.basicsStorageAll,
      decodedNonce,
      NCALayerClient.basicsCMSParamsAttached,
      NCALayerClient.basicsSignerSignAny
    );

    if (signed.includes("-----BEGIN CMS-----")) {
      signed = signed
        .replace("-----BEGIN CMS-----", "")
        .replace("-----END CMS-----", "")
        .replace(/\r?\n|\r/g, "")
        .trim();
    }

    const resp = await fetch(BACKEND_ECP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signed_data: signed, nonce: NONCE, client_id: CLIENT_ID }),
    });

    const data = await resp.json();

    if (resp.ok) {
      const redirectUrl = new URL(REDIRECT_URI);
      redirectUrl.searchParams.set("access_token", data.access_token);
      redirectUrl.searchParams.set("id_token", data.id_token);
      redirectUrl.searchParams.set("state", STATE);
      window.location.href = redirectUrl.toString();
    } else {
      setStatus(data.error || data.message || "Ошибка входа через ЭЦП", true);
    }
  } catch (err) {
    setStatus("Ошибка подписи: " + err.message, true);
  }
}
