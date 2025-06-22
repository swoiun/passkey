const form = document.getElementById('register-form');
const resultDiv = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultDiv.textContent = '';
  resultDiv.className = '';

  const username = document.getElementById('username').value.trim();
  if (!username) {
    resultDiv.textContent = `이름을 입력해주세요.`;
    resultDiv.classList.add('error');
    return;
  }

  try {
    const res = await fetch('/generate-registration-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!res.ok) {
      resultDiv.textContent = `서버에 문제가 발생했습니다.`;
      resultDiv.classList.add('error');
      return;
    }

    const options = await res.json();
    options.challenge = base64urlToBuffer(options.challenge);
    options.user.id = base64urlToBuffer(options.user.id);

    const credential = await navigator.credentials.create({ publicKey: options });

    if (credential) {
      resultDiv.textContent = `패스키가 성공적으로 생성되었습니다!`;
      resultDiv.classList.add('success');
    } else {
      resultDiv.textContent = `패스키 생성에 실패했습니다. 다시 시도해주세요.`;
      resultDiv.classList.add('error');
    }

  } catch (err) {
    resultDiv.textContent = `패스키 생성에 실패했습니다. 다시 시도해주세요.`;
    resultDiv.classList.add('error');
  }
});

function base64urlToBuffer(base64url) {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
