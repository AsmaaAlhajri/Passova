(function () {
  "use strict";

  var auth = window.PassovaAuth;
  var form = document.getElementById("signup-form");
  var submit = document.getElementById("submit");
  var success = document.getElementById("form-success");

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    auth.clearError();
    success.hidden = true;

    var fullName = value("full-name").replace(/^dr\.?\s+/i, "");
    var email = value("email");
    var password = document.getElementById("password").value;

    if (!fullName) return auth.showError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return auth.showError("Enter a valid email address.");
    if (password.length < 8) return auth.showError("The password must be at least 8 characters.");

    auth.setBusy(submit, true, "Create account");
    auth.db.auth
      .signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName, position: value("position"), team: value("team") },
          emailRedirectTo: new URL("index.html", window.location.href).href,
        },
      })
      .then(function (res) {
        auth.setBusy(submit, false, "Create account");
        if (res.error) {
          auth.showError(auth.friendly(res.error));
          return;
        }
        if (res.data.session) {
          window.location.replace("home.html");
          return;
        }
        // Email confirmation is switched on for the project.
        form.reset();
        success.textContent =
          "Account created. We sent a confirmation link to " + email + ". Open it, then sign in.";
        success.hidden = false;
      });
  });
})();
