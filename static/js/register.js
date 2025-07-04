// HTML 요소 가져오기
const form = document.getElementById('register-form');
const resultDiv = document.getElementById('result');

// 폼 제출 이벤트 리스너
form.addEventListener('submit', async (e) => {
  e.preventDefault(); // 기본 폼 제출 방지

  // 이전 메시지 초기화
  resultDiv.textContent = '';
  resultDiv.className = 'message-box'; // 기본 클래스 유지

  const usernameInput = document.getElementById('username');
  const username = usernameInput.value.trim(); // 사용자 이름 가져오기

  // 사용자 이름이 비어있는지 확인
  if (!username) {
    resultDiv.textContent = `이름을 입력해주세요.`;
    resultDiv.classList.add('error');
    usernameInput.focus(); // 입력 필드에 포커스
    return;
  }

  try {
    // 서버에 패스키 등록 옵션 요청
    const res = await fetch('/generate-registration-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    // 서버 응답 확인
    if (!res.ok) {
      const errorData = await res.json();
      resultDiv.textContent = `서버 오류: ${errorData.message || '알 수 없는 오류'}`;
      resultDiv.classList.add('error');
      return;
    }

    // 서버에서 받은 옵션 파싱
    const options = await res.json();

    // Challenge와 User ID를 Buffer로 변환 (WebAuthn API 요구사항)
    options.challenge = base64urlToBuffer(options.challenge);
    options.user.id = base64urlToBuffer(options.user.id);

    // authenticatorSelection 속성이 존재하고 userVerification이 문자열인 경우에만 설정
    if (options.authenticatorSelection && typeof options.authenticatorSelection.userVerification === 'string') {
      options.authenticatorSelection.userVerification = options.authenticatorSelection.userVerification;
    }

    // WebAuthn API를 사용하여 패스키 생성
    const credential = await navigator.credentials.create({ publicKey: options });

    // 패스키 생성 성공 여부 확인
    if (credential) {
      resultDiv.textContent = `패스키가 성공적으로 생성되었습니다!`;
      resultDiv.classList.add('success');
      // 여기에 생성된 패스키를 서버에 저장하는 로직을 추가할 수 있습니다.
      // 예: fetch('/verify-registration', { method: 'POST', body: JSON.stringify(credential) });
    } else {
      resultDiv.textContent = `패스키 생성에 실패했습니다. 다시 시도해주세요.`;
      resultDiv.classList.add('error');
    }

  } catch (err) {
    console.error('패스키 생성 중 오류 발생:', err);
    // 사용자에게는 간결한 오류 메시지만 표시
    resultDiv.textContent = `패스키 생성에 실패했습니다. 다시 시도해주세요.`;
    resultDiv.classList.add('error');
  }
});

/**
 * Base64URL 문자열을 Uint8Array 버퍼로 변환합니다.
 * WebAuthn API는 특정 데이터를 ArrayBuffer 또는 Uint8Array 형식으로 요구합니다.
 * @param {string} base64url - Base64URL로 인코딩된 문자열
 * @returns {Uint8Array} - 변환된 Uint8Array 버퍼
 */
function base64urlToBuffer(base64url) {
  // Base64URL은 URL 안전을 위해 '+'와 '/' 대신 '-'와 '_'를 사용하고 패딩 '='을 생략할 수 있습니다.
  // atob()는 표준 Base64를 기대하므로 변환이 필요합니다.
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64); // Base64 문자열을 이진 문자열로 디코딩
  // 이진 문자열을 Uint8Array로 변환
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
