const crypto = require("crypto");

class SwiggyOAuthProvider {
  constructor(options = {}) {
    this._redirectUrl = options.redirectUrl;
    this._state = options.state || crypto.randomBytes(24).toString("base64url");
    this._clientInformation = options.clientInformation;
    this._tokens = options.tokens;
    this._codeVerifier = options.codeVerifier;
    this.authorizationUrl = null;
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: "Recipe Basket Builder",
      redirect_uris: [this._redirectUrl],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp:tools"
    };
  }

  state() {
    return this._state;
  }

  clientInformation() {
    return this._clientInformation;
  }

  saveClientInformation(clientInformation) {
    this._clientInformation = clientInformation;
  }

  tokens() {
    return this._tokens;
  }

  saveTokens(tokens) {
    this._tokens = tokens;
  }

  redirectToAuthorization(authorizationUrl) {
    this.authorizationUrl = authorizationUrl.toString();
  }

  saveCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier() {
    if (!this._codeVerifier) {
      throw new Error("Missing PKCE code verifier.");
    }

    return this._codeVerifier;
  }

  exportPending(extensionId) {
    return {
      type: "swiggy_oauth_pending",
      extensionId,
      state: this._state,
      clientInformation: this._clientInformation,
      codeVerifier: this._codeVerifier,
      createdAt: Date.now()
    };
  }
}

module.exports = { SwiggyOAuthProvider };
