(function () {
  "use strict";

  var auth = window.PassovaAuth;
  var form = document.getElementById("login-form");
  var email = document.getElementById("email");
  var password = document.getElementById("password");
  var submit = document.getElementById("submit");

  // Already signed in: go straight to the board.
  auth.db.auth.getSession().then(function (res) {
    if (res.data && res.data.session) window.location.replace("home.html");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    auth.clearError();

    if (!email.value.trim() || !password.value) {
      auth.showError("Enter your email and password.");
      return;
    }

    auth.setBusy(submit, true, "Sign in");
    auth.db.auth
      .signInWithPassword({ email: email.value.trim(), password: password.value })
      .then(function (res) {
        if (res.error) {
          auth.setBusy(submit, false, "Sign in");
          auth.showError(auth.friendly(res.error));
          password.value = "";
          password.focus();
          return;
        }
        window.location.replace("home.html");
      });
  });
})();
