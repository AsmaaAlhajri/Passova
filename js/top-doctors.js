// Top doctors: the three doctors who marked the most patients and
// endorsements as seen in a calendar month (Kuwait time).
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;
  var me = null;

  var KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
  var PLACES = ["1st", "2nd", "3rd"];

  var monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

  // The month being shown, as { year, month } with month 0–11.
  function thisMonth() {
    var k = new Date(Date.now() + KUWAIT_OFFSET_MS);
    return { year: k.getUTCFullYear(), month: k.getUTCMonth() };
  }

  var shown = thisMonth();

  function bounds(m) {
    return {
      start: new Date(Date.UTC(m.year, m.month, 1) - KUWAIT_OFFSET_MS).toISOString(),
      end: new Date(Date.UTC(m.year, m.month + 1, 1) - KUWAIT_OFFSET_MS).toISOString(),
    };
  }

  function step(m, by) {
    var d = new Date(Date.UTC(m.year, m.month + by, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }

  function isCurrent(m) {
    var now = thisMonth();
    return m.year === now.year && m.month === now.month;
  }

  P.renderShell("top");

  // ---------- Drawing ----------

  function seenText(n) {
    return n + (n === 1 ? " patient seen" : " patients seen");
  }

  function doctorLabel(row) {
    var name = row.full_name || "A doctor";
    return /^dr\.?\s/i.test(name) ? name : "Dr. " + name;
  }

  function podiumCard(row, index) {
    var place = index + 1;
    if (!row) {
      return el("li", { class: "podium-card is-empty place-" + place }, [
        el("span", { class: "podium-place", text: PLACES[index] }),
        el("span", { class: "podium-avatar", text: "–" }),
        el("p", { class: "podium-name", text: "No one yet" }),
        el("p", { class: "podium-count", text: " " }),
      ]);
    }
    var name = doctorLabel(row);
    var mine = me && row.doctor_id === me.user.id;
    return el("li", { class: "podium-card place-" + place + (mine ? " is-me" : "") }, [
      el("span", { class: "podium-place", text: PLACES[index] }),
      el("span", { class: "podium-avatar", text: P.initials(name) }),
      el("p", { class: "podium-name", text: name + (mine ? " (you)" : "") }),
      row.position ? el("p", { class: "podium-position", text: row.position }) : null,
      el("p", { class: "podium-count" }, [
        el("strong", { text: String(row.seen_count) }),
        " " + (row.seen_count === 1 ? "patient seen" : "patients seen"),
      ]),
    ]);
  }

  function render(rows) {
    var podium = document.getElementById("podium");
    podium.textContent = "";
    for (var i = 0; i < 3; i++) podium.appendChild(podiumCard(rows[i], i));

    var myRank = document.getElementById("my-rank");
    var at = -1;
    rows.forEach(function (r, i) { if (me && r.doctor_id === me.user.id) at = i; });
    myRank.hidden = false;
    var when = isCurrent(shown) ? "this month" : "in " + monthLabel.format(new Date(Date.UTC(shown.year, shown.month, 15)));
    if (!rows.length) {
      myRank.textContent = "Nobody has marked a patient as seen " + when + " yet.";
    } else if (at === -1) {
      myRank.textContent = "You haven't marked any patients as seen " + when + ".";
    } else if (at < 3) {
      myRank.textContent = "You're in the top three " + when + " with " + seenText(rows[at].seen_count) + ".";
    } else {
      myRank.textContent = "You're number " + (at + 1) + " " + when + ", with " + seenText(rows[at].seen_count) + ".";
    }
  }

  function load() {
    var b = bounds(shown);
    document.getElementById("month-label").textContent =
      monthLabel.format(new Date(Date.UTC(shown.year, shown.month, 15)));
    document.getElementById("next-month").disabled = isCurrent(shown);

    return P.db.rpc("seen_leaderboard", { month_start: b.start, month_end: b.end }).then(function (res) {
      if (res.error) {
        P.toast("Could not load top doctors", P.errorMessage(res.error), "error");
        return;
      }
      render(res.data || []);
    });
  }

  document.getElementById("prev-month").addEventListener("click", function () {
    shown = step(shown, -1);
    load();
  });

  document.getElementById("next-month").addEventListener("click", function () {
    if (isCurrent(shown)) return;
    shown = step(shown, 1);
    load();
  });

  P.requireAuth().then(function (session) {
    me = session;
    P.fillDrawerUser();
    load();
    // Someone marking a patient as seen changes the counts.
    P.onDataChange(function () {
      if (isCurrent(shown)) load();
    });
  });
})();
