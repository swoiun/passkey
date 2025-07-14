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
import requests
from dotenv import load_dotenv
from fido2.ctap2 import AttestationObject
from fido2.client import ClientData
from fido2.utils import websafe_decode
import cbor2

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(32)

RP_NAME = "Passkey Test Site"

# RP_ID = "localhost"
RP_ID = "passkey-test.shop"
ORIGIN = f"https://{RP_ID}"


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
  raise RuntimeError("SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")

@app.route("/")
def register():
  return render_template("register.html")

@app.route("/generate-registration-options", methods=["POST"])
def generate_registration_options():
  username = request.json.get("username")
  if not username:
    return jsonify({"message": "사용자 이름이 필요합니다."}), 400

  user_id = os.urandom(16)
  session.update({
    "user_id": base64.urlsafe_b64encode(user_id).decode(),
    "username": username,
  })

  options = PublicKeyCredentialCreationOptions(
    rp=PublicKeyCredentialRpEntity(id=RP_ID, name=RP_NAME),
    user=PublicKeyCredentialUserEntity(id=user_id, name=username, display_name=username),
    challenge=os.urandom(32),
    pub_key_cred_params=[PublicKeyCredentialParameters(type="public-key", alg=-7)],
    authenticator_selection=AuthenticatorSelectionCriteria(user_verification=UserVerificationRequirement.PREFERRED),
    timeout=60000,
    attestation=AttestationConveyancePreference.NONE,
  )

  session["challenge"] = base64.urlsafe_b64encode(options.challenge).decode()
  return jsonify(json.loads(options_to_json(options)))

@app.route("/register", methods=["POST"])
def register_passkey():
  data = request.get_json(force=True)
  credential = data.get("credential")
  username = session.get("username")
  if not credential or not username:
    return jsonify({"status": "error", "message": "등록 정보가 부족합니다."}), 400

  attestation_object = websafe_decode(credential["response"]["attestationObject"])
  client_data_json   = websafe_decode(credential["response"]["clientDataJSON"])

  att_obj = AttestationObject(attestation_object)
  ClientData(client_data_json)

  pk_obj = att_obj.auth_data.credential_data.public_key
  pk_bytes = None
  for attr in ("encode", "to_bytes"):
    if hasattr(pk_obj, attr):
      try:
        pk_bytes = getattr(pk_obj, attr)()
        break
      except Exception:
        pk_bytes = None
  if pk_bytes is None:
    try:
      pk_bytes = cbor2.dumps(pk_obj)
    except Exception:
      pk_bytes = cbor2.dumps({"error": "unserializable key"})
  public_key = pk_bytes.hex()

  payload = {
    "username": username,
    "credential_id": credential.get("id"),
    "public_key": public_key,
    "sign_count": getattr(att_obj.auth_data, "sign_count", getattr(att_obj.auth_data, "counter", 0)),
  }

  headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
  }

  res = requests.post(
    f"{SUPABASE_URL}/rest/v1/passkey",
    headers=headers,
    json=payload,
  )
  print("Supabase response:", res.status_code, res.text)

  if not res.ok:
    return jsonify({"status": "error", "message": f"Supabase {res.status_code}: {res.text}"}), 500

  return jsonify({"status": "ok"})

if __name__ == "__main__":
  app.run(host="localhost", port=8000, debug=True)
