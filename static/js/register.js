function bufferDecode(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

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

function showMessage(type, message) {
  resultBox.className = `message-box ${type}`;
  resultBox.textContent = message;

  // 강제로 리플로우를 일으켜 애니메이션 초기화
  void resultBox.offsetWidth;
  resultBox.classList.add('show');

  // 3초 뒤 .show 클래스 제거 (애니메이션 재사용 가능하게)
  setTimeout(() => {
    resultBox.classList.remove('show');
  }, 3000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  if (!username) return;

  try {
    const optRes = await fetch('/generate-registration-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const options = await optRes.json();

    const cred = await navigator.credentials.create({
      publicKey: preformatCreate(options)
    });

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
      showMessage('success', '패스키 등록 성공!');
    } else {
      throw new Error(regJson.message || '등록 실패');
    }
  } catch (err) {
    showMessage('error', `오류: ${err.message}`);
  }
});
