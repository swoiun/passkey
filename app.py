from flask import Flask, render_template, request, jsonify, session
from webauthn.helpers import options_to_json
from webauthn.helpers.structs import (
    PublicKeyCredentialCreationOptions,
    PublicKeyCredentialRpEntity,
    PublicKeyCredentialUserEntity,
    PublicKeyCredentialParameters,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AttestationConveyancePreference,
)
import os
import base64
import json

# Flask 애플리케이션 초기화
app = Flask(__name__)
# 세션 관리를 위한 시크릿 키 설정 (보안을 위해 실제 배포 시에는 강력한 키 사용)
app.secret_key = os.urandom(32)

# Relying Party (RP) 정보 설정
# RP_NAME: 사용자에게 표시될 웹사이트 이름
RP_NAME = "Passkey Test Site"
# RP_ID: 웹사이트의 도메인 (예: "example.com"). localhost 환경에서는 "localhost"
RP_ID = "localhost"
# ORIGIN: 웹사이트의 전체 URL (프로토콜, 도메인, 포트 포함)
ORIGIN = "http://localhost:8000"

# 정적 파일 경로 설정 (CSS, JS 파일이 /static/ 디렉토리에 있다고 가정)
# Flask는 기본적으로 static 폴더를 정적 파일 제공에 사용합니다.

@app.route("/")
def register():
    """
    루트 경로 ("/")로 접속하면 register.html 템플릿을 렌더링합니다.
    이 페이지에서 사용자는 패스키 등록을 시작할 수 있습니다.
    """
    return render_template("register.html")

@app.route("/generate-registration-options", methods=["POST"])
def generate_registration_options():
    """
    클라이언트로부터 사용자 이름을 받아 패스키 등록을 위한 옵션을 생성합니다.
    이 옵션은 WebAuthn API 호출에 사용됩니다.
    """
    username = request.json.get("username")
    if not username:
        return jsonify({"message": "사용자 이름이 필요합니다."}), 400

    # 사용자 ID 생성 (각 사용자마다 고유해야 함)
    # 실제 애플리케이션에서는 데이터베이스에서 사용자 ID를 가져와야 합니다.
    user_id = os.urandom(16)

    # 세션에 사용자 ID와 사용자 이름을 저장합니다.
    # 이는 이후 패스키 등록 완료 후 검증 단계에서 사용될 수 있습니다.
    session["user_id"] = base64.urlsafe_b64encode(user_id).decode("utf-8")
    session["username"] = username

    # PublicKeyCredentialCreationOptions 객체 생성
    # 이 객체는 WebAuthn API의 navigator.credentials.create() 함수에 전달됩니다.
    options = PublicKeyCredentialCreationOptions(
        rp=PublicKeyCredentialRpEntity(id=RP_ID, name=RP_NAME), # Relying Party 정보
        user=PublicKeyCredentialUserEntity(id=user_id, name=username, display_name=username), # 사용자 정보
        challenge=os.urandom(32), # 서버에서 생성한 임의의 바이트 시퀀스 (보안을 위해 중요)
        pub_key_cred_params=[
            # 지원하는 공개 키 자격 증명 유형 및 알고리즘
            # alg=-7은 ES256 (ECDSA with P-256 and SHA-256)을 의미합니다.
            PublicKeyCredentialParameters(type="public-key", alg=-7)
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            # 인증자 선택 기준: 사용자 확인을 선호 (예: 지문, PIN)
            user_verification=UserVerificationRequirement.PREFERRED
        ),
        timeout=60000, # 작업 시간 초과 (밀리초)
        attestation=AttestationConveyancePreference.NONE # 증명 선호도 (간소화)
    )

    # 생성된 challenge를 세션에 저장합니다.
    # 이는 클라이언트에서 패스키가 생성된 후 서버에서 검증할 때 사용됩니다.
    session["challenge"] = base64.urlsafe_b64encode(options.challenge).decode("utf-8")

    # WebAuthn 옵션 객체를 JSON 형식으로 변환하여 클라이언트에 반환
    return jsonify(json.loads(options_to_json(options)))

# 애플리케이션 실행
if __name__ == "__main__":
    # debug=True는 개발 중 코드 변경 시 서버를 자동으로 재시작하고 디버깅 정보를 제공합니다.
    # 실제 배포 환경에서는 debug=False로 설정해야 합니다.
    app.run(host="localhost", port=8000, debug=True)
