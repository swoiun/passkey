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

app = Flask(__name__)
app.secret_key = os.urandom(32)

RP_NAME = "Test Passkey Site"
RP_ID = "localhost"
ORIGIN = "http://localhost:8000"


@app.route("/")
def register():
    return render_template("register.html")

@app.route("/generate-registration-options", methods=["POST"])
def generate_registration_options():
    username = request.json.get("username")
    user_id = os.urandom(16)

    session["user_id"] = base64.urlsafe_b64encode(user_id).decode("utf-8")
    session["username"] = username

    options = PublicKeyCredentialCreationOptions(
        rp=PublicKeyCredentialRpEntity(id=RP_ID, name=RP_NAME),
        user=PublicKeyCredentialUserEntity(id=user_id, name=username, display_name=username),
        challenge=os.urandom(32),
        pub_key_cred_params=[
            PublicKeyCredentialParameters(type="public-key", alg=-7)
        ],
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED
        ),
        timeout=60000,
        attestation=AttestationConveyancePreference.NONE
    )

    session["challenge"] = base64.urlsafe_b64encode(options.challenge).decode("utf-8")

    return jsonify(json.loads(options_to_json(options)))

if __name__ == "__main__":
    app.run(host="localhost", port=8000, debug=True)
