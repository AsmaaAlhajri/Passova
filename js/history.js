// Admin only: every endorsement and admission, a month at a time, grouped
// by shift. Nothing here ever clears, and removed patients stay listed.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;

  var KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000;
  var SHIFT_OFFSET_MS = (3 - 8) * 60 * 60 * 1000;
  var DAY_MS = 24 * 60 * 60 * 1000;

  var monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
  var shiftLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuwait", weekday: "long", day: "numeric", month: "long" });
  var dateTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  var entries = [];
  var orders = [];
  var kindFilter = "";

  function thisMonth() {
    var k = new Date(Date.now() + KUWAIT_OFFSET_MS);
    return { year: k.getUTCFullYear(), month: k.getUTCMonth() };
  }
  var shown = thisMonth();

  function isCurrent(m) {
    var now = thisMonth();
    return m.year === now.year && m.month === now.month;
  }

  function step(m, by) {
    var d = new Date(Date.UTC(m.year, m.month + by, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }

  function bounds(m) {
    return {
      start: new Date(Date.UTC(m.year, m.month, 1) - KUWAIT_OFFSET_MS).toISOString(),
      end: new Date(Date.UTC(m.year, m.month + 1, 1) - KUWAIT_OFFSET_MS).toISOString(),
    };
  }

  function shiftOf(iso) {
    return Math.floor((new Date(iso).getTime() + SHIFT_OFFSET_MS) / DAY_MS);
  }

  P.renderShell("history");

  // ---------- Drawing ----------

  function detail(label, value) {
    if (!value) return null;
    return el("div", { class: "history-detail" }, [
      el("span", { class: "ipass-sub", text: label }),
      el("p", { text: value }),
    ]);
  }

  function orderLines(e) {
    var key = e.kind === "endorsement" ? "endorsement_id" : "admission_id";
    var mine = orders.filter(function (o) { return o[key] === e.row.id; });
    if (!mine.length) return null;
    return el("div", { class: "history-detail" }, [
      el("span", { class: "ipass-sub", text: e.kind === "endorsement" ? "Action list" : "Orders" }),
      el("ul", { class: "history-orders" }, mine.map(function (o) {
        return el("li", { class: o.done ? "is-done" : "" }, [
          el("span", { text: (o.done ? "✓ " : "○ ") + o.label }),
          o.done ? el("span", { class: "muted", text: " — " + P.doctorName(o.done_by) + ", " + dateTime.format(new Date(o.done_at)) }) : null,
        ]);
      })),
    ]);
  }

  function entryCard(e) {
    var p = e.row;
    var isEndorsement = e.kind === "endorsement";
    var details = isEndorsement
      ? [
          detail("Working differential diagnosis", p.working_diagnosis),
          detail("Overview", p.summary),
          detail("Ongoing assessment", p.ongoing_assessment),
          detail("Suggested plan", p.plan),
          detail("Suggestions (if / then)", p.suggestions),
          detail("Synthesis by receiver", p.synthesis),
          orderLines(e),
        ]
      : [orderLines(e)];
    var hasDetails = details.some(Boolean);

    var facts = [P.formatAge(p), p.gender ? (p.gender === "male" ? "Male" : "Female") : null].filter(Boolean).join(" · ");
    var seen = p.status === "seen"
      ? "Seen by " + P.doctorName(p.seen_by) + " · " + dateTime.format(new Date(p.seen_at))
      : P.STATUS[p.status];

    var card = el("article", { class: "history-card card" + (p.deleted_at ? " is-removed" : "") }, [
      el("div", { class: "history-top" }, [
        el("span", { class: "tag " + (isEndorsement ? "tag-kind-endorse" : "tag-kind-admit"), text: isEndorsement ? "Endorsement" : "Admission" }),
        el("span", { class: "tag tag-bed", text: P.bedLabel(p) }),
        isEndorsement ? el("span", { class: "tag tag-team", text: "Team " + p.team }) : null,
        isEndorsement ? P.severityChip(p.severity) : el("span", { class: "acuity acuity-" + p.condition, text: P.CONDITION[p.condition] }),
        p.deleted_at ? el("span", { class: "tag tag-removed", text: "Removed " + dateTime.format(new Date(p.deleted_at)) }) : null,
      ]),
      el("h3", { class: "history-name" }, [
        p.patient_name,
        facts ? el("span", { class: "muted", text: " · " + facts }) : null,
      ]),
      el("p", { class: "history-dx", text: isEndorsement ? p.working_diagnosis : p.diagnosis }),
      el("p", { class: "history-meta" }, [
        el("span", { text: "Entered by " + P.doctorName(p.created_by) + " · " + dateTime.format(new Date(p.created_at)) }),
        el("span", { class: "history-status status-text-" + p.status.replace("_", "-"), text: seen }),
      ]),
    ]);

    if (hasDetails) {
      var box = el("div", { class: "history-details", hidden: true }, details);
      var toggle = el("button", { type: "button", class: "btn-text", "aria-expanded": "false", text: "Show details" });
      toggle.addEventListener("click", function () {
        box.hidden = !box.hidden;
        toggle.setAttribute("aria-expanded", String(!box.hidden));
        toggle.textContent = box.hidden ? "Show details" : "Hide details";
      });
      card.appendChild(toggle);
      card.appendChild(box);
    }
    return card;
  }

  function matches(e, q) {
    if (!q) return true;
    var p = e.row;
    return [p.patient_name, p.working_diagnosis, p.diagnosis, p.summary, P.bedLabel(p),
      P.doctorName(p.created_by), p.seen_by ? P.doctorName(p.seen_by) : ""]
      .join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function render() {
    P.closePop();
    var list = document.getElementById("history-list");
    var q = document.getElementById("search").value.trim().toLowerCase();
    var rows = entries.filter(function (e) {
      return (!kindFilter || e.kind === kindFilter) && matches(e, q);
    });

    var endorseCount = rows.filter(function (e) { return e.kind === "endorsement"; }).length;
    document.getElementById("summary").textContent = rows.length
      ? endorseCount + (endorseCount === 1 ? " endorsement" : " endorsements") + " and " +
        (rows.length - endorseCount) + ((rows.length - endorseCount) === 1 ? " admission" : " admissions")
      : "";

    list.textContent = "";
    var lastShift = null;
    var group = null;
    rows.forEach(function (e) {
      var shift = shiftOf(e.row.created_at);
      if (shift !== lastShift) {
        lastShift = shift;
        var start = new Date(shift * DAY_MS - SHIFT_OFFSET_MS);
        group = el("section", { class: "history-group" }, [
          el("h2", { class: "history-shift" }, [
            shiftLabel.format(start) + " shift",
            el("span", { class: "muted", text: " · Team " + P.teamOnCall(shift) + " on call" }),
          ]),
        ]);
        list.appendChild(group);
      }
      group.appendChild(entryCard(e));
    });

    if (!rows.length) {
      list.appendChild(el("p", { class: "rows-empty", text: entries.length
        ? "Nothing matches your search."
        : "No endorsements or admissions in this month." }));
    }
  }

  function load() {
    var b = bounds(shown);
    document.getElementById("month-label").textContent = monthLabel.format(new Date(Date.UTC(shown.year, shown.month, 15)));
    document.getElementById("next-month").disabled = isCurrent(shown);
    document.getElementById("summary").textContent = "Loading…";

    return Promise.all([
      P.db.from("endorsements").select("*").gte("created_at", b.start).lt("created_at", b.end).order("created_at", { ascending: false }),
      P.db.from("admissions").select("*").gte("created_at", b.start).lt("created_at", b.end).order("created_at", { ascending: false }),
      P.db.from("orders").select("*").gte("created_at", b.start).lt("created_at", b.end),
      P.loadProfiles(),
    ]).then(function (res) {
      for (var i = 0; i < 3; i++) if (res[i].error) throw res[i].error;
      orders = res[2].data;
      entries = res[0].data.map(function (row) { return { kind: "endorsement", row: row }; })
        .concat(res[1].data.map(function (row) { return { kind: "admission", row: row }; }))
        .sort(function (a, b) { return b.row.created_at.localeCompare(a.row.created_at); });
      render();
    }).catch(function (error) {
      document.getElementById("summary").textContent = "";
      P.toast("Could not load the history", P.errorMessage(error), "error");
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
  document.getElementById("search").addEventListener("input", render);
  document.querySelectorAll(".filter-btn[data-kind]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      kindFilter = btn.getAttribute("data-kind");
      document.querySelectorAll(".filter-btn[data-kind]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      render();
    });
  });

  P.requireAdmin().then(function () {
    P.fillDrawerUser();
    load();
  });
})();
