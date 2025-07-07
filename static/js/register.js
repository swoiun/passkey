// register.js – WebAuthn passkey registration

// Base64URL → Uint8Array decoder
function bufferDecode(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Convert incoming options JSON to proper format (ArrayBuffers)
function preformatCreate(options) {
  options.challenge = bufferDecode(options.challenge);
  options.user.id   = bufferDecode(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map(cred => ({
      ...cred,
      id: bufferDecode(cred.id)
    }));
  }
  return options;
}

const form = document.getElementById('register-form');
const resultBox = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  if (!username) return;

  try {
    // 1. 요청 옵션 받기
    const optRes = await fetch('/generate-registration-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const options = await optRes.json();

    // 2. navigator.credentials.create 호출 (옵션 형식 조정)
    const cred = await navigator.credentials.create({ publicKey: preformatCreate(options) });

    // 3. 결과를 서버에 전송 – ArrayBuffers → base64url
    const attObj = new Uint8Array(cred.response.attestationObject);
    const clientData = new Uint8Array(cred.response.clientDataJSON);

    function bufferEncode(buf) {
      return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    const payload = {
      username,
      credential: {
        id: cred.id,
        type: cred.type,
        rawId: bufferEncode(cred.rawId),
        response: {
          attestationObject: bufferEncode(attObj),
          clientDataJSON: bufferEncode(clientData)
        }
      }
    };

    const regRes = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const regJson = await regRes.json();
    if (regJson.status === 'ok') {
      resultBox.className = 'message-box success';
      resultBox.textContent = '패스키 등록 성공!';
    } else {
      throw new Error(regJson.message || '등록 실패');
    }
  } catch (err) {
    resultBox.className = 'message-box error';
    resultBox.textContent = `오류: ${err.message}`;
  }
});
