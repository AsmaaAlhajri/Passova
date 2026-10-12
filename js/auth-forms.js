// Shared bits for the sign-in and sign-up pages.
(function () {
  "use strict";

  var config = window.PASSOVA_CONFIG;
  var db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  var eyeOpen =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeClosed =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5.1-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/></svg>';

  document.querySelectorAll("[data-toggle-for]").forEach(function (toggle) {
    var input = document.getElementById(toggle.getAttribute("data-toggle-for"));
    toggle.innerHTML = eyeOpen;
    toggle.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
      toggle.innerHTML = show ? eyeClosed : eyeOpen;
    });
  });

  var errorBox = document.getElementById("form-error");

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function friendly(error) {
    var msg = (error && error.message) || "";
    if (/invalid login credentials/i.test(msg)) return "That email and password do not match an account.";
    if (/email not confirmed/i.test(msg)) return "Please confirm your email first: open the link we sent you, then sign in.";
    if (/already registered|already been registered/i.test(msg)) return "An account with this email already exists. Sign in instead.";
    if (/password should be at least/i.test(msg)) return "The password must be at least 6 characters.";
    if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/fetch/i.test(msg)) return "Could not reach the server. Check the connection and try again.";
    return msg || "Something went wrong. Please try again.";
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.textContent = busy ? "Please wait…" : label;
  }

  window.PassovaAuth = {
    db: db,
    showError: showError,
    clearError: clearError,
    friendly: friendly,
    setBusy: setBusy,
  };
})();
