(() => {
  "use strict";
  const choices = new Map([
    ["mobile-390-current-captured", 390],
    ["mobile-320-current-captured", 320],
    ["desktop-415-current-captured", 415],
    ["desktop-620-current-captured", 620],
    ["mobile-320-history-attempts", 320]
  ]);
  const chooser = document.getElementById("sample");
  const before = document.getElementById("before");
  const after = document.getElementById("after");
  function render() {
    if (!choices.has(chooser.value)) return;
    document.documentElement.style.setProperty("--width", choices.get(chooser.value) + "px");
    before.src = "./legacy-boxes/" + chooser.value + ".png";
    after.src = "./screenshots/" + chooser.value + ".png";
  }
  const requested = new URLSearchParams(location.search).get("sample");
  if (choices.has(requested)) chooser.value = requested;
  chooser.addEventListener("change", render);
  render();
})();
