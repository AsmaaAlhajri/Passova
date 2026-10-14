// My profile: the doctor's name, position, team and phone.
(function () {
  "use strict";

  var P = window.Passova;
  var me = null;

  P.renderShell("profile");

  var form = document.getElementById("profile-form");
  var saveBtn = document.getElementById("save");
  var errorBox = document.getElementById("form-error");

  function field(id) {
    return document.getElementById(id);
  }

  function showProfile(profile) {
    var name = P.doctorName(me.user.id);
    field("profile-name").textContent = profile && profile.full_name ? name : "Add your name";
    field("profile-email").textContent = me.user.email;
    field("profile-avatar").textContent = P.initials(name);
  }

  function fillForm(profile) {
    field("full-name").value = (profile && profile.full_name) || "";
    field("position").value = (profile && profile.position) || "";
    field("team").value = profile && profile.team ? String(profile.team) : "";
    field("phone").value = (profile && profile.phone) || "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = true;

    var fullName = field("full-name").value.trim().replace(/^dr\.?\s+/i, "");
    if (!fullName) {
      errorBox.textContent = "Enter your full name.";
      errorBox.hidden = false;
      field("full-name").focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    P.db.from("profiles")
      .update({
        full_name: fullName,
        position: field("position").value || null,
        team: field("team").value ? Number(field("team").value) : null,
        phone: field("phone").value.trim() || null,
      })
      .eq("id", me.user.id)
      .select("id, full_name, position, team, phone")
      .single()
      .then(function (res) {
        if (res.error) {
          errorBox.textContent = P.errorMessage(res.error);
          errorBox.hidden = false;
          return;
        }
        P.profiles[me.user.id] = res.data;
        me.profile = res.data;
        fillForm(res.data);
        showProfile(res.data);
        P.fillDrawerUser();
        P.toast("Profile saved", "Your details are up to date.", "ok");
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save changes";
      });
  });

  // Every patient or endorsement this doctor has marked as seen, counted by
  // the database from its permanent seen log.
  function loadCounts() {
    P.db.rpc("my_seen_counts").then(function (res) {
      if (res.error) {
        P.toast("Could not load your counts", P.errorMessage(res.error), "error");
        return;
      }
      var row = (res.data && res.data[0]) || { this_month: 0, all_time: 0 };
      field("seen-month").textContent = row.this_month;
      field("seen-all").textContent = row.all_time;
    });
  }

  P.requireAuth().then(function (session) {
    me = session;
    P.fillDrawerUser();
    loadCounts();
    fillForm(me.profile);
    showProfile(me.profile);
    if (!me.profile || !me.profile.full_name) field("full-name").focus();
  });
})();
